using Gms.BuildingBlocks;
using Gms.Modules.Attendance.Public;
using Gms.Modules.Branches.Public;
using Gms.Modules.Coaching.Domain;
using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

/// <summary>
/// Coach assignments — POST create (Management: front-desk activity), GET paged list
/// (Staff, coach role scoped to their own rows), POST {id}/release (Management or the
/// owning coach). One ACTIVE assignment per coach-member pair is enforced by a partial
/// unique index at the DB level; the released rows stay as history.
/// </summary>
public static class AssignmentsEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        CreateEndpoint.Map(app);
        SearchEndpoint.Map(app);
        ReleaseEndpoint.Map(app);
    }

    private static class CreateEndpoint
    {
        public sealed record CreateAssignmentRequest(Guid CoachId, Guid MemberId, Guid? BranchId, string? Note);

        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/v1/coaching/assignments", async (
                    CreateAssignmentRequest request,
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    IAttendanceModule attendance,
                    CancellationToken cancellationToken) =>
                {
                    // ---- coach: must be an active coach account (contract call, no Identity EF)
                    var coaches = await identity.GetCoachesAsync(cancellationToken);
                    var coach = coaches.FirstOrDefault(c => c.Id == request.CoachId)
                        ?? throw new GmsException(ErrorCodes.CoachingCoachNotFound, "No active coach with this id.", 404);

                    // ---- member: must exist and be Active
                    var member = await members.GetAsync(request.MemberId, cancellationToken)
                        ?? throw new GmsException(ErrorCodes.CoachingMemberNotFound, "Member not found.", 404);
                    if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingMemberInactive,
                            "Coaching can only be assigned to active members.",
                            400);
                    }

                    // ---- branch: reception/coach are pinned to their own branch (JWT claim);
                    //      admin (no branch claim) must pass an explicit branchId.
                    Guid? userBranchId = CoachingAccess.ClaimBranchId(user);
                    var branchId = userBranchId ?? request.BranchId;
                    if (branchId is null)
                    {
                        throw new GmsException(
                            ErrorCodes.ValidationFailed,
                            "Branch could not be determined.",
                            400,
                            new Dictionary<string, string[]> { ["branchId"] = ["Select the branch for this assignment."] });
                    }
                    if (!await branches.ExistsAsync(branchId.Value, cancellationToken))
                    {
                        throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                    }

                    // ---- duplicate gate: one active assignment per coach-member pair
                    var existsActive = await db.CoachAssignments.AsNoTracking()
                        .AnyAsync(a => a.CoachId == request.CoachId
                            && a.MemberId == request.MemberId
                            && a.ReleasedAtUtc == null, cancellationToken);
                    if (existsActive)
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingAssignmentExists,
                            "This coach already has an active assignment for this member.",
                            409);
                    }

                    var assignment = new CoachAssignment
                    {
                        CoachId = coach.Id,
                        MemberId = member.Id,
                        BranchId = branchId.Value,
                        AssignedAtUtc = DateTime.UtcNow,
                        Note = request.Note?.Trim(),
                    };
                    db.CoachAssignments.Add(assignment);

                    try
                    {
                        await db.SaveChangesAsync(cancellationToken);
                    }
                    catch (DbUpdateException)
                    {
                        // Concurrent duplicate — the partial unique index (CoachId, MemberId WHERE ReleasedAtUtc IS NULL) fired.
                        throw new GmsException(
                            ErrorCodes.CoachingAssignmentExists,
                            "This coach already has an active assignment for this member.",
                            409);
                    }

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        [assignment.MemberId], [assignment.CoachId], [], cancellationToken);
                    var isPresent = await attendance.IsMemberPresentAsync(assignment.MemberId, cancellationToken);

                    return Results.Created($"/api/v1/coaching/assignments/{assignment.Id}", assignment.ToView(lookup, isPresent));
                })
                .RequireAuthorization(Policies.Management)
                .WithTags("Coaching")
                .WithSummary("Assign a coach to a member (one active pair; released rows become history).");
        }
    }

    private static class SearchEndpoint
    {
        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/v1/coaching/assignments", async (
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    IAttendanceModule attendance,
                    Guid? coachId,
                    Guid? memberId,
                    Guid? branchId,
                    string? status,
                    string? search,
                    int page,
                    int pageSize,
                    CancellationToken cancellationToken) =>
                {
                    var currentPage = page > 0 ? page : 1;
                    var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                    // Coach role sees only their own assignments, pinned to their branch.
                    Guid? scopeCoachId = coachId;
                    Guid? scopeBranchId = branchId;
                    if (CoachingAccess.IsCoachRole(user))
                    {
                        scopeCoachId = CoachingAccess.SubjectId(user);
                        scopeBranchId = CoachingAccess.ClaimBranchId(user) ?? scopeBranchId;
                    }

                    var query = db.CoachAssignments.AsNoTracking().AsQueryable();
                    if (scopeCoachId is { } coachFilter)
                    {
                        query = query.Where(a => a.CoachId == coachFilter);
                    }
                    if (memberId is { } memberFilter)
                    {
                        query = query.Where(a => a.MemberId == memberFilter);
                    }
                    if (scopeBranchId is { } branchFilter)
                    {
                        query = query.Where(a => a.BranchId == branchFilter);
                    }
                    if (string.Equals(status, "active", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(a => a.ReleasedAtUtc == null);
                    }
                    else if (string.Equals(status, "released", StringComparison.OrdinalIgnoreCase))
                    {
                        query = query.Where(a => a.ReleasedAtUtc != null);
                    }

                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        // Members module owns its data — resolve matching ids through the contract (no JOINs).
                        var memberIds = await members.FindIdsAsync(search, 200, cancellationToken);
                        query = query.Where(a => memberIds.Contains(a.MemberId));
                    }

                    var totalCount = await query.CountAsync(cancellationToken);
                    var items = await query
                        .OrderBy(a => a.ReleasedAtUtc == null ? 0 : 1)
                        .ThenByDescending(a => a.AssignedAtUtc)
                        .Skip((currentPage - 1) * currentPageSize)
                        .Take(currentPageSize)
                        .ToListAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        items.Select(a => a.MemberId),
                        items.Select(a => a.CoachId),
                        [],
                        cancellationToken);

                    // Live presence badges for the page's members (Attendance public contract).
                    var presence = await CoachingViews.LoadPresenceAsync(
                        attendance, items.Where(a => a.ReleasedAtUtc == null).Select(a => a.MemberId), cancellationToken);

                    var views = items
                        .Select(a => a.ToView(lookup, presence.TryGetValue(a.MemberId, out var present) && present))
                        .ToList();

                    return Results.Ok(new PagedResult<CoachAssignmentView>(views, currentPage, currentPageSize, totalCount));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Paged assignments (active first). Coaches are scoped to their own rows.");
        }
    }

    private static class ReleaseEndpoint
    {
        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/v1/coaching/assignments/{id:guid}/release", async (
                    Guid id,
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    CancellationToken cancellationToken) =>
                {
                    var assignment = await db.CoachAssignments.FirstOrDefaultAsync(a => a.Id == id, cancellationToken)
                        ?? throw new GmsException(ErrorCodes.CoachingAssignmentNotFound, "Coach assignment not found.", 404);

                    // A coach may release only their own assignment; management may release any.
                    if (CoachingAccess.IsCoachRole(user) && assignment.CoachId != CoachingAccess.SubjectId(user))
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingForbidden,
                            "Coaches can only release their own assignments.",
                            403);
                    }

                    if (assignment.ReleasedAtUtc is not null)
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingAlreadyReleased,
                            "This assignment has already been released.",
                            409);
                    }

                    assignment.ReleasedAtUtc = DateTime.UtcNow;
                    assignment.UpdatedAtUtc = DateTime.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        [assignment.MemberId], [assignment.CoachId], [], cancellationToken);

                    return Results.Ok(assignment.ToView(lookup, memberIsPresent: false));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Release an assignment (the pair can be re-assigned later; history is kept).");
        }
    }
}
