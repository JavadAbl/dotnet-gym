using Gms.Modules.Attendance.Public;
using Gms.Modules.Coaching.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

/// <summary>
/// GET /api/v1/coaching/summary — coach-workspace KPIs. A coach gets their own numbers;
/// admin/reception get the gym-wide totals (or a specific coach's via ?coachId=).
/// "Present now" consumes the Attendance public contract (Phase 4 prepared this hook).
/// </summary>
public static class SummaryEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/coaching/summary", async (
                ClaimsPrincipal user,
                CoachingDbContext db,
                IAttendanceModule attendance,
                Guid? coachId,
                CancellationToken cancellationToken) =>
            {
                Guid? scopeCoachId = coachId;
                if (CoachingAccess.IsCoachRole(user))
                {
                    scopeCoachId = CoachingAccess.SubjectId(user);
                }

                var now = DateTime.UtcNow;
                var weekAgo = now.AddDays(-7);

                var assignmentsQuery = db.CoachAssignments.AsNoTracking()
                    .Where(a => a.ReleasedAtUtc == null);
                var plansQuery = db.TrainingPlans.AsNoTracking()
                    .Where(p => p.IsActive);
                var recordsQuery = db.TrainingRecords.AsNoTracking()
                    .Where(r => r.PerformedAtUtc >= weekAgo);

                if (scopeCoachId is { } coachFilter)
                {
                    assignmentsQuery = assignmentsQuery.Where(a => a.CoachId == coachFilter);
                    plansQuery = plansQuery.Where(p => p.CoachId == coachFilter);
                    recordsQuery = recordsQuery.Where(r => r.CoachId == coachFilter);
                }

                var activeAssignments = await assignmentsQuery.CountAsync(cancellationToken);
                var activePlans = await plansQuery.CountAsync(cancellationToken);
                var recordsLast7Days = await recordsQuery.CountAsync(cancellationToken);

                // Members currently in the gym among the (scoped) actively assigned —
                // resolved via the Attendance contract, bounded to the first 100 pairs.
                var assignedMemberIds = await assignmentsQuery
                    .Select(a => a.MemberId)
                    .Distinct()
                    .Take(100)
                    .ToListAsync(cancellationToken);

                var membersPresentNow = 0;
                foreach (var memberId in assignedMemberIds)
                {
                    if (await attendance.IsMemberPresentAsync(memberId, cancellationToken))
                    {
                        membersPresentNow++;
                    }
                }

                return Results.Ok(new CoachingSummary(activeAssignments, activePlans, recordsLast7Days, membersPresentNow));
            })
            .RequireAuthorization(Policies.Staff)
            .WithTags("Coaching")
            .WithSummary("Coach-workspace KPIs: active assignments, active plans, 7-day sessions, members present now.");
    }
}
