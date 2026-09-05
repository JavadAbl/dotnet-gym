using Gms.BuildingBlocks;
using Gms.Modules.Coaching.Domain;
using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

/// <summary>
/// Training plans — POST create (admin or coach; coach is always the author for their
/// own members), GET paged list (Staff, coach role scoped), POST {id}/archive. Creating
/// a plan REQUIRES an active coach-member assignment and auto-archives the author's
/// previous active plan for that member (exactly one active plan per pair).
/// </summary>
public static class PlansEndpoints
{
    public static void Map(IEndpointRouteBuilder app)
    {
        CreateEndpoint.Map(app);
        SearchEndpoint.Map(app);
        ArchiveEndpoint.Map(app);
    }

    private static class CreateEndpoint
    {
        public sealed record CreatePlanRequest(Guid? CoachId, Guid MemberId, string Title, string? Goal, string Content);

        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/v1/coaching/plans", async (
                    CreatePlanRequest request,
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    CancellationToken cancellationToken) =>
                {
                    CoachingAccess.EnsureCoachOrAdmin(user);
                    var coachId = CoachingAccess.ResolveActingCoachId(user, request.CoachId);

                    var errors = new Dictionary<string, string[]>();
                    var title = request.Title?.Trim();
                    var content = request.Content?.Trim();
                    if (string.IsNullOrEmpty(title))
                    {
                        errors["title"] = ["Plan title is required."];
                    }
                    if (string.IsNullOrEmpty(content))
                    {
                        errors["content"] = ["Plan content is required."];
                    }
                    if (errors.Count > 0)
                    {
                        throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                    }

                    // ---- coach must be a real, active coach account
                    var coaches = await identity.GetCoachesAsync(cancellationToken);
                    if (!coaches.Any(c => c.Id == coachId))
                    {
                        throw new GmsException(ErrorCodes.CoachingCoachNotFound, "No active coach with this id.", 404);
                    }

                    // ---- member must exist and be Active
                    var member = await members.GetAsync(request.MemberId, cancellationToken)
                        ?? throw new GmsException(ErrorCodes.CoachingMemberNotFound, "Member not found.", 404);
                    if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingMemberInactive,
                            "Coaching can only be assigned to active members.",
                            400);
                    }

                    // ---- assignment gate: plans are written for assigned members only
                    var hasAssignment = await db.CoachAssignments.AsNoTracking()
                        .AnyAsync(a => a.CoachId == coachId
                            && a.MemberId == request.MemberId
                            && a.ReleasedAtUtc == null, cancellationToken);
                    if (!hasAssignment)
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingMemberNotAssigned,
                            "The member is not assigned to this coach; assign them first.",
                            409);
                    }

                    // ---- archive the author's previous active plan for this member (history preserved)
                    var now = DateTime.UtcNow;
                    var previous = await db.TrainingPlans
                        .Where(p => p.CoachId == coachId && p.MemberId == request.MemberId && p.IsActive)
                        .ToListAsync(cancellationToken);
                    foreach (var plan in previous)
                    {
                        plan.IsActive = false;
                        plan.ArchivedAtUtc = now;
                        plan.UpdatedAtUtc = now;
                    }

                    var created = new TrainingPlan
                    {
                        CoachId = coachId,
                        MemberId = request.MemberId,
                        Title = title!,
                        Goal = request.Goal?.Trim(),
                        Content = content!,
                        IsActive = true,
                        CreatedAtUtc = now,
                    };
                    db.TrainingPlans.Add(created);
                    await db.SaveChangesAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        [created.MemberId], [created.CoachId], [], cancellationToken);

                    return Results.Created($"/api/v1/coaching/plans/{created.Id}", created.ToView(lookup));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Create a training plan for an assigned member (auto-archives the previous active plan).");
        }
    }

    private static class SearchEndpoint
    {
        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/v1/coaching/plans", async (
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    Guid? coachId,
                    Guid? memberId,
                    bool? activeOnly,
                    string? search,
                    int page,
                    int pageSize,
                    CancellationToken cancellationToken) =>
                {
                    var currentPage = page > 0 ? page : 1;
                    var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                    Guid? scopeCoachId = coachId;
                    if (CoachingAccess.IsCoachRole(user))
                    {
                        scopeCoachId = CoachingAccess.SubjectId(user);
                    }

                    var query = db.TrainingPlans.AsNoTracking().AsQueryable();
                    if (scopeCoachId is { } coachFilter)
                    {
                        query = query.Where(p => p.CoachId == coachFilter);
                    }
                    if (memberId is { } memberFilter)
                    {
                        query = query.Where(p => p.MemberId == memberFilter);
                    }
                    if (activeOnly == true)
                    {
                        query = query.Where(p => p.IsActive);
                    }

                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var memberIds = await members.FindIdsAsync(search, 200, cancellationToken);
                        query = query.Where(p => memberIds.Contains(p.MemberId));
                    }

                    var totalCount = await query.CountAsync(cancellationToken);
                    var items = await query
                        .OrderByDescending(p => p.CreatedAtUtc)
                        .Skip((currentPage - 1) * currentPageSize)
                        .Take(currentPageSize)
                        .ToListAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        items.Select(p => p.MemberId),
                        items.Select(p => p.CoachId),
                        [],
                        cancellationToken);

                    var views = items.Select(p => p.ToView(lookup)).ToList();
                    return Results.Ok(new PagedResult<TrainingPlanView>(views, currentPage, currentPageSize, totalCount));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Paged training plans. Coaches are scoped to their own plans.");
        }
    }

    private static class ArchiveEndpoint
    {
        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/v1/coaching/plans/{id:guid}/archive", async (
                    Guid id,
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    CancellationToken cancellationToken) =>
                {
                    CoachingAccess.EnsureCoachOrAdmin(user);

                    var plan = await db.TrainingPlans.FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                        ?? throw new GmsException(ErrorCodes.CoachingPlanNotFound, "Training plan not found.", 404);

                    if (CoachingAccess.IsCoachRole(user) && plan.CoachId != CoachingAccess.SubjectId(user))
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingForbidden,
                            "Coaches can only archive their own plans.",
                            403);
                    }

                    if (!plan.IsActive)
                    {
                        throw new GmsException(
                            ErrorCodes.CoachingPlanNotActive,
                            "This plan is already archived.",
                            409);
                    }

                    plan.IsActive = false;
                    plan.ArchivedAtUtc = DateTime.UtcNow;
                    plan.UpdatedAtUtc = DateTime.UtcNow;
                    await db.SaveChangesAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        [plan.MemberId], [plan.CoachId], [], cancellationToken);

                    return Results.Ok(plan.ToView(lookup));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Archive a plan (it stops counting as the member's active plan).");
        }
    }
}
