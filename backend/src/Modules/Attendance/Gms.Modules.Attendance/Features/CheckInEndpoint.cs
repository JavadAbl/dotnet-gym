using Gms.BuildingBlocks;
using Gms.Modules.Attendance.Domain;
using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance.Features;

/// <summary>
/// POST /api/v1/attendance/check-in — the card-swipe entry gate (admin, reception).
/// Validation pipeline (plan §2 Entry validation): member Active → no open entry → an EXERCISE
/// member package (v2: private-coaching packages never pay for gym entry) that is Active, not
/// frozen, not expired, with sessions remaining, and granted to the current branch. The session
/// is then consumed ATOMICALLY via <see cref="ISalesModule.TryConsumeSessionAsync"/> (checked rows = 1 ⇒ success).
/// </summary>
public static class CheckInEndpoint
{
    public sealed record CheckInRequest(string CardCode, Guid? BranchId);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/attendance/check-in", async (
                CheckInRequest request,
                ClaimsPrincipal user,
                AttendanceDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                ISalesModule sales,
                CancellationToken cancellationToken) =>
            {
                // ---- card code: required (RFID reader or manual entry)
                var cardCode = request.CardCode?.Trim();
                if (string.IsNullOrEmpty(cardCode))
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Card code is required.",
                        400,
                        new Dictionary<string, string[]> { ["cardCode"] = ["Swipe a card or type its code."] });
                }

                // ---- branch: reception/coach are pinned to their own branch (JWT claim);
                //      admin (no branch claim) must pass an explicit branchId.
                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var branchId = userBranchId ?? request.BranchId;
                if (branchId is null)
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Branch could not be determined.",
                        400,
                        new Dictionary<string, string[]> { ["branchId"] = ["Select the branch for this check-in."] });
                }

                if (!await branches.ExistsAsync(branchId.Value, cancellationToken))
                {
                    throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                }

                // ---- member gate: card must resolve, member must be Active
                var member = await members.GetByCardCodeAsync(cardCode, cancellationToken)
                    ?? throw new GmsException(
                        ErrorCodes.AttendanceMemberNotFound,
                        "No member is registered with this card code.",
                        404);

                if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                {
                    throw new GmsException(
                        ErrorCodes.AttendanceMemberInactive,
                        "Inactive or blocked members cannot check in.",
                        400);
                }

                // ---- presence gate: one open visit at a time
                var hasOpenEntry = await db.AttendanceEntries.AsNoTracking()
                    .AnyAsync(e => e.MemberId == member.Id && e.CheckOutAtUtc == null, cancellationToken);
                if (hasOpenEntry)
                {
                    throw new GmsException(
                        ErrorCodes.AttendanceAlreadyCheckedIn,
                        "This member is already checked in.",
                        409);
                }

                // ---- package gate: pick the member's usable package for this visit.
                //      Usable = EXERCISE kind (v2 — gym entry never burns private-coaching sessions),
                //      status Active, not expired, sessions remaining (frozen/refunded excluded).
                var now = DateTime.UtcNow;
                var allPackages = await sales.GetForMemberAsync(member.Id, cancellationToken);

                var exercisePackages = allPackages
                    .Where(mp => string.Equals(mp.PackageKind, "Exercise", StringComparison.Ordinal))
                    .ToList();

                var candidates = exercisePackages
                    .Where(mp => string.Equals(mp.Status, "Active", StringComparison.Ordinal)
                        && mp.ExpiresAtUtc > now
                        && mp.SessionsUsed < mp.SessionsTotal)
                    .ToList();

                // Branch access is a property of the catalog package (locked decision #4),
                // checked through the Catalog public contract — never by JOINing its tables.
                var usable = new List<MemberPackageDto>();
                foreach (var candidate in candidates)
                {
                    if (await catalog.IsPackageAvailableInBranchAsync(candidate.PackageId, branchId.Value, cancellationToken))
                    {
                        usable.Add(candidate);
                    }
                }

                if (usable.Count == 0)
                {
                    throw new GmsException(
                        ClassifyDenial(candidates, exercisePackages, now),
                        DenialMessage(candidates, exercisePackages, now),
                        409);
                }

                // Use the package expiring soonest first (FEFO) — standard gym practice.
                var chosen = usable.OrderBy(mp => mp.ExpiresAtUtc).First();

                // ---- ATOMIC session consumption (plan §2): one conditional UPDATE.
                //      The pre-validation above is only UX; this is the source of truth.
                var consumed = await sales.TryConsumeSessionAsync(chosen.Id, cancellationToken);
                if (!consumed)
                {
                    // Lost a race (another desk / another branch consumed the last session).
                    throw new GmsException(
                        ErrorCodes.AttendanceEntryConflict,
                        "The package state changed concurrently; no session was consumed.",
                        409);
                }

                var entry = new AttendanceEntry
                {
                    MemberId = member.Id,
                    MemberPackageId = chosen.Id,
                    BranchId = branchId.Value,
                    CheckInAtUtc = now,
                };
                db.AttendanceEntries.Add(entry);

                try
                {
                    await db.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    // Concurrent check-in of the same member — the partial unique index fired.
                    // Note: the session was already consumed (TryConsume is the atomic gate and
                    // cannot be rolled back through the Sales contract). The member is inside on
                    // the other open visit, so the pragmatic outcome is one consumed session.
                    throw new GmsException(
                        ErrorCodes.AttendanceAlreadyCheckedIn,
                        "This member is already checked in.",
                        409);
                }

                var lookup = await AttendanceViews.LoadLookupAsync(
                    members, catalog, branches, sales, [member.Id], [entry.MemberPackageId], cancellationToken);
                var view = entry.ToView(lookup, DateTime.UtcNow);

                return Results.Created($"/api/v1/attendance/entries/{entry.Id}", view);
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Attendance")
            .WithSummary("Card-swipe check-in: validates entry, atomically consumes one session, opens a visit.");
    }

    /// <summary>Precise machine-readable denial reason for the receptionist, by precedence.</summary>
    private static string ClassifyDenial(
        IReadOnlyCollection<MemberPackageDto> candidates,
        IReadOnlyList<MemberPackageDto> exercisePackages,
        DateTime nowUtc)
    {
        if (candidates.Count > 0)
        {
            // Candidates exist but none are granted to this branch.
            return ErrorCodes.AttendanceBranchNotAllowed;
        }

        if (exercisePackages.Any(mp => string.Equals(mp.Status, "Frozen", StringComparison.Ordinal)))
        {
            return ErrorCodes.AttendancePackageFrozen;
        }

        if (exercisePackages.Any(mp => string.Equals(mp.Status, "Active", StringComparison.Ordinal) && mp.ExpiresAtUtc <= nowUtc))
        {
            return ErrorCodes.AttendancePackageExpired;
        }

        if (exercisePackages.Any(mp => string.Equals(mp.Status, "Active", StringComparison.Ordinal)
            && mp.ExpiresAtUtc > nowUtc
            && mp.SessionsUsed >= mp.SessionsTotal))
        {
            return ErrorCodes.AttendanceNoSessionsRemaining;
        }

        return ErrorCodes.AttendanceNoActivePackage;
    }

    private static string DenialMessage(
        IReadOnlyCollection<MemberPackageDto> candidates,
        IReadOnlyList<MemberPackageDto> exercisePackages,
        DateTime nowUtc) =>
        ClassifyDenial(candidates, exercisePackages, nowUtc) switch
        {
            ErrorCodes.AttendanceBranchNotAllowed =>
                "The member's package is not granted to this branch.",
            ErrorCodes.AttendancePackageFrozen =>
                "The member's package is frozen; unfreeze it before check-in.",
            ErrorCodes.AttendancePackageExpired =>
                "The member's package has expired.",
            ErrorCodes.AttendanceNoSessionsRemaining =>
                "The member's package has no sessions remaining.",
            _ => "The member has no usable exercise package.",
        };
}
