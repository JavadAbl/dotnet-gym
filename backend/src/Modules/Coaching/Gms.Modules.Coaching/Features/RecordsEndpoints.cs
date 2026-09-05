using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Coaching.Domain;
using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

/// <summary>
/// Training records — POST log a completed personal-training session (admin or coach),
/// GET paged history (Staff, coach role scoped to own rows and branch). Like plans,
/// logging REQUIRES an active coach-member assignment. Optionally links to the plan
/// the session followed (same coach-member pair, in-module id reference).
/// </summary>
public static class RecordsEndpoints
{
    private static readonly HashSet<string> AllowedIntensities = new(StringComparer.Ordinal)
    {
        "Low", "Medium", "High",
    };

    public static void Map(IEndpointRouteBuilder app)
    {
        CreateEndpoint.Map(app);
        SearchEndpoint.Map(app);
    }

    private static class CreateEndpoint
    {
        public sealed record CreateRecordRequest(
            Guid? CoachId,
            Guid MemberId,
            Guid? TrainingPlanId,
            string Summary,
            DateTime? PerformedAtUtc,
            int? DurationMinutes,
            string? Intensity,
            string? Note,
            Guid? BranchId);

        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapPost("/api/v1/coaching/records", async (
                    CreateRecordRequest request,
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    CancellationToken cancellationToken) =>
                {
                    CoachingAccess.EnsureCoachOrAdmin(user);
                    var coachId = CoachingAccess.ResolveActingCoachId(user, request.CoachId);

                    var summary = request.Summary?.Trim();
                    var errors = new Dictionary<string, string[]>();
                    if (string.IsNullOrEmpty(summary))
                    {
                        errors["summary"] = ["Session summary is required."];
                    }
                    if (request.DurationMinutes is { } duration && (duration < 1 || duration > 600))
                    {
                        errors["durationMinutes"] = ["Duration must be between 1 and 600 minutes."];
                    }
                    if (!string.IsNullOrEmpty(request.Intensity) && !AllowedIntensities.Contains(request.Intensity))
                    {
                        errors["intensity"] = ["Intensity must be Low, Medium or High."];
                    }
                    var performedAt = request.PerformedAtUtc ?? DateTime.UtcNow;
                    if (performedAt > DateTime.UtcNow.AddMinutes(5))
                    {
                        errors["performedAtUtc"] = ["The session time cannot be in the future."];
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

                    // ---- assignment gate: sessions are logged for assigned members only
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

                    // ---- optional plan link: must belong to the same coach-member pair (in-module check)
                    if (request.TrainingPlanId is { } planId && planId != Guid.Empty)
                    {
                        var planExists = await db.TrainingPlans.AsNoTracking()
                            .AnyAsync(p => p.Id == planId && p.CoachId == coachId && p.MemberId == request.MemberId, cancellationToken);
                        if (!planExists)
                        {
                            throw new GmsException(ErrorCodes.CoachingPlanNotFound, "Training plan not found for this coach-member pair.", 404);
                        }
                    }

                    // ---- branch: pinned from JWT claim (coach/reception) or explicit (admin)
                    Guid? userBranchId = CoachingAccess.ClaimBranchId(user);
                    var branchId = userBranchId ?? request.BranchId;
                    if (branchId is null)
                    {
                        throw new GmsException(
                            ErrorCodes.ValidationFailed,
                            "Branch could not be determined.",
                            400,
                            new Dictionary<string, string[]> { ["branchId"] = ["Select the branch where the session took place."] });
                    }
                    if (!await branches.ExistsAsync(branchId.Value, cancellationToken))
                    {
                        throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                    }

                    var record = new TrainingRecord
                    {
                        CoachId = coachId,
                        MemberId = request.MemberId,
                        TrainingPlanId = request.TrainingPlanId is { } linked && linked != Guid.Empty ? linked : null,
                        BranchId = branchId.Value,
                        PerformedAtUtc = performedAt,
                        Summary = summary!,
                        DurationMinutes = request.DurationMinutes,
                        Intensity = string.IsNullOrEmpty(request.Intensity) ? null : request.Intensity,
                        Note = request.Note?.Trim(),
                    };
                    db.TrainingRecords.Add(record);
                    await db.SaveChangesAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        [record.MemberId], [record.CoachId],
                        record.TrainingPlanId is null ? [] : [record.TrainingPlanId.Value],
                        cancellationToken);

                    return Results.Created($"/api/v1/coaching/records/{record.Id}", record.ToView(lookup));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Log a completed training session for an assigned member.");
        }
    }

    private static class SearchEndpoint
    {
        public static void Map(IEndpointRouteBuilder app)
        {
            app.MapGet("/api/v1/coaching/records", async (
                    ClaimsPrincipal user,
                    CoachingDbContext db,
                    IIdentityModule identity,
                    IMembersModule members,
                    IBranchesModule branches,
                    Guid? coachId,
                    Guid? memberId,
                    Guid? branchId,
                    string? search,
                    int page,
                    int pageSize,
                    CancellationToken cancellationToken) =>
                {
                    var currentPage = page > 0 ? page : 1;
                    var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                    Guid? scopeCoachId = coachId;
                    Guid? scopeBranchId = branchId;
                    if (CoachingAccess.IsCoachRole(user))
                    {
                        scopeCoachId = CoachingAccess.SubjectId(user);
                        scopeBranchId = CoachingAccess.ClaimBranchId(user) ?? scopeBranchId;
                    }

                    var query = db.TrainingRecords.AsNoTracking().AsQueryable();
                    if (scopeCoachId is { } coachFilter)
                    {
                        query = query.Where(r => r.CoachId == coachFilter);
                    }
                    if (memberId is { } memberFilter)
                    {
                        query = query.Where(r => r.MemberId == memberFilter);
                    }
                    if (scopeBranchId is { } branchFilter)
                    {
                        query = query.Where(r => r.BranchId == branchFilter);
                    }

                    if (!string.IsNullOrWhiteSpace(search))
                    {
                        var memberIds = await members.FindIdsAsync(search, 200, cancellationToken);
                        query = query.Where(r => memberIds.Contains(r.MemberId));
                    }

                    var totalCount = await query.CountAsync(cancellationToken);
                    var items = await query
                        .OrderByDescending(r => r.PerformedAtUtc)
                        .Skip((currentPage - 1) * currentPageSize)
                        .Take(currentPageSize)
                        .ToListAsync(cancellationToken);

                    var lookup = await CoachingViews.LoadLookupAsync(
                        identity, members, branches, db,
                        items.Select(r => r.MemberId),
                        items.Select(r => r.CoachId),
                        items.Select(r => r.TrainingPlanId).Where(id => id != null).Select(id => id!.Value),
                        cancellationToken);

                    var views = items.Select(r => r.ToView(lookup)).ToList();
                    return Results.Ok(new PagedResult<TrainingRecordView>(views, currentPage, currentPageSize, totalCount));
                })
                .RequireAuthorization(Policies.Staff)
                .WithTags("Coaching")
                .WithSummary("Paged training history. Coaches are scoped to their own sessions.");
        }
    }
}
