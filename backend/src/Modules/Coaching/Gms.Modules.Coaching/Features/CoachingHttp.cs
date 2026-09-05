using Gms.BuildingBlocks;
using Gms.Modules.Attendance.Public;
using Gms.Modules.Branches.Public;
using Gms.Modules.Coaching.Domain;
using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

// ---------------------------------------------------------------- enriched HTTP views (locale-neutral: both En/Fa names)

public sealed record CoachView(Guid Id, string DisplayName, string Username, Guid? BranchId);

public sealed record CoachAssignmentView(
    Guid Id,
    Guid CoachId,
    Guid MemberId,
    Guid BranchId,
    DateTime AssignedAtUtc,
    DateTime? ReleasedAtUtc,
    string? Note,
    string CoachName,
    string MemberCode,
    string MemberFullName,
    string MemberStatus,
    string BranchNameEn,
    string BranchNameFa,
    bool MemberIsPresent,
    // v2 — live private-coaching entitlement (null ⇒ the member has no usable private package).
    int? PrivateSessionsRemaining,
    int? PrivateSessionsTotal);

public sealed record TrainingPlanView(
    Guid Id,
    Guid CoachId,
    Guid MemberId,
    string Title,
    string? Goal,
    string Content,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? ArchivedAtUtc,
    string CoachName,
    string MemberCode,
    string MemberFullName);

public sealed record TrainingRecordView(
    Guid Id,
    Guid CoachId,
    Guid MemberId,
    Guid? TrainingPlanId,
    Guid BranchId,
    DateTime PerformedAtUtc,
    string Summary,
    int? DurationMinutes,
    string? Intensity,
    string? Note,
    string CoachName,
    string MemberCode,
    string MemberFullName,
    string BranchNameEn,
    string BranchNameFa,
    string? PlanTitle);

/// <summary>Coach-workspace KPIs (scoped to the requesting coach when the role is coach).</summary>
public sealed record CoachingSummary(
    int ActiveAssignments,
    int ActivePlans,
    int RecordsLast7Days,
    int MembersPresentNow);

// ---------------------------------------------------------------- shared enrichment helpers

/// <summary>Resolved display data for cross-module ids (coaches, members, branches, plan titles).</summary>
internal sealed record CoachingLookup(
    IReadOnlyDictionary<Guid, AuthUserDto> Coaches,
    IReadOnlyDictionary<Guid, MemberPublicDto> Members,
    IReadOnlyDictionary<Guid, BranchDto> Branches,
    IReadOnlyDictionary<Guid, string> PlanTitles);

internal static class CoachingViews
{
    /// <summary>
    /// Batch-resolves coach / member / branch names through the public contracts and
    /// plan titles with one in-module query (no cross-module JOINs anywhere). History
    /// rows referencing deactivated coach accounts fall back to <see cref="IIdentityModule.GetAsync"/>.
    /// </summary>
    public static async Task<CoachingLookup> LoadLookupAsync(
        IIdentityModule identity,
        IMembersModule members,
        IBranchesModule branches,
        CoachingDbContext db,
        IEnumerable<Guid> memberIds,
        IEnumerable<Guid> coachIds,
        IEnumerable<Guid> planIds,
        CancellationToken cancellationToken)
    {
        var coachMap = (await identity.GetCoachesAsync(cancellationToken)).ToDictionary(c => c.Id);
        foreach (var coachId in coachIds.Distinct())
        {
            if (coachId != Guid.Empty && !coachMap.ContainsKey(coachId))
            {
                var deactivated = await identity.GetAsync(coachId, cancellationToken);
                if (deactivated is not null)
                {
                    coachMap[coachId] = deactivated;
                }
            }
        }

        var memberList = await members.GetBatchAsync(memberIds.Distinct().ToList(), cancellationToken);
        var branchList = await branches.GetAllAsync(cancellationToken);

        var planIdList = planIds.Where(id => id != Guid.Empty).Distinct().ToList();
        var planTitles = planIdList.Count == 0
            ? new Dictionary<Guid, string>()
            : await db.TrainingPlans.AsNoTracking()
                .Where(p => planIdList.Contains(p.Id))
                .Select(p => new { p.Id, p.Title })
                .ToDictionaryAsync(p => p.Id, p => p.Title, cancellationToken);

        return new CoachingLookup(
            coachMap,
            memberList.ToDictionary(m => m.Id),
            branchList.ToDictionary(b => b.Id),
            planTitles);
    }

    public static string CoachName(this CoachingLookup lookup, Guid coachId) =>
        lookup.Coaches.TryGetValue(coachId, out var coach) ? coach.DisplayName : "—";

    public static CoachAssignmentView ToView(
        this CoachAssignment assignment,
        CoachingLookup lookup,
        bool memberIsPresent,
        IReadOnlyDictionary<Guid, MemberPackageDto>? privatePackages = null) =>
        new(
            assignment.Id,
            assignment.CoachId,
            assignment.MemberId,
            assignment.BranchId,
            assignment.AssignedAtUtc,
            assignment.ReleasedAtUtc,
            assignment.Note,
            lookup.CoachName(assignment.CoachId),
            lookup.Members.TryGetValue(assignment.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(assignment.MemberId, out member) ? member.FullName : "—",
            lookup.Members.TryGetValue(assignment.MemberId, out member) ? member.Status : "—",
            lookup.Branches.TryGetValue(assignment.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(assignment.BranchId, out branch) ? branch.NameFa : "—",
            memberIsPresent,
            privatePackages is not null
                && privatePackages.TryGetValue(assignment.MemberId, out var privatePackage)
                    ? privatePackage.SessionsTotal - privatePackage.SessionsUsed
                    : null,
            privatePackages is not null
                && privatePackages.TryGetValue(assignment.MemberId, out privatePackage)
                    ? privatePackage.SessionsTotal
                    : null);

    public static TrainingPlanView ToView(this TrainingPlan plan, CoachingLookup lookup) =>
        new(
            plan.Id,
            plan.CoachId,
            plan.MemberId,
            plan.Title,
            plan.Goal,
            plan.Content,
            plan.IsActive,
            plan.CreatedAtUtc,
            plan.ArchivedAtUtc,
            lookup.CoachName(plan.CoachId),
            lookup.Members.TryGetValue(plan.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(plan.MemberId, out member) ? member.FullName : "—");

    public static TrainingRecordView ToView(this TrainingRecord record, CoachingLookup lookup) =>
        new(
            record.Id,
            record.CoachId,
            record.MemberId,
            record.TrainingPlanId,
            record.BranchId,
            record.PerformedAtUtc,
            record.Summary,
            record.DurationMinutes,
            record.Intensity,
            record.Note,
            lookup.CoachName(record.CoachId),
            lookup.Members.TryGetValue(record.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(record.MemberId, out member) ? member.FullName : "—",
            lookup.Branches.TryGetValue(record.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(record.BranchId, out branch) ? branch.NameFa : "—",
            record.TrainingPlanId is { } planId && lookup.PlanTitles.TryGetValue(planId, out var title) ? title : null);

    /// <summary>Live presence for the current page's members via the Attendance public contract (bounded by page size).</summary>
    public static async Task<IReadOnlyDictionary<Guid, bool>> LoadPresenceAsync(
        IAttendanceModule attendance, IEnumerable<Guid> memberIds, CancellationToken cancellationToken)
    {
        var result = new Dictionary<Guid, bool>();
        foreach (var memberId in memberIds.Distinct())
        {
            result[memberId] = await attendance.IsMemberPresentAsync(memberId, cancellationToken);
        }
        return result;
    }
}

// ---------------------------------------------------------------- role/branch scoping (JWT claims)

internal static class CoachingAccess
{
    public static string? Role(ClaimsPrincipal user) => user.FindFirstValue(ClaimTypes.Role);

    public static bool IsCoachRole(ClaimsPrincipal user) => string.Equals(Role(user), UserRoles.Coach, StringComparison.Ordinal);

    public static Guid? SubjectId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public static Guid? ClaimBranchId(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue("branchId"), out var id) ? id : null;

    /// <summary>
    /// Plans and records are coach craft: the coach writes them for their own members,
    /// admin may act on behalf of any coach. Reception/buffet are read-only → 403.
    /// </summary>
    public static void EnsureCoachOrAdmin(ClaimsPrincipal user)
    {
        var role = Role(user);
        var allowed = string.Equals(role, UserRoles.Admin, StringComparison.Ordinal)
            || string.Equals(role, UserRoles.Coach, StringComparison.Ordinal);
        if (!allowed)
        {
            throw new GmsException(
                ErrorCodes.CoachingForbidden,
                "Only admins and coaches may manage training plans and records.",
                403);
        }
    }

    /// <summary>Resolves the acting coach: a coach is always themselves; an admin must pass coachId explicitly.</summary>
    public static Guid ResolveActingCoachId(ClaimsPrincipal user, Guid? requestedCoachId)
    {
        if (IsCoachRole(user))
        {
            return SubjectId(user)
                ?? throw new GmsException(ErrorCodes.CoachingForbidden, "Coach identity could not be resolved from the token.", 403);
        }

        if (requestedCoachId is { } coachId && coachId != Guid.Empty)
        {
            return coachId;
        }

        throw new GmsException(
            ErrorCodes.ValidationFailed,
            "coachId is required.",
            400,
            new Dictionary<string, string[]> { ["coachId"] = ["Select the coach this action belongs to."] });
    }
}
