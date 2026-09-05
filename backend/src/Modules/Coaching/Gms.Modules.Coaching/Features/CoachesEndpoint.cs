using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Features;

/// <summary>
/// GET /api/v1/coaching/coaches — active coach accounts for the assignment dialog
/// (Management: assignment is a front-desk activity). Resolved through the Identity
/// public contract — the Coaching module never touches Identity's EF layer.
/// </summary>
public static class CoachesEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/coaching/coaches", async (
                IIdentityModule identity,
                CoachingDbContext db,
                CancellationToken cancellationToken) =>
            {
                var coaches = await identity.GetCoachesAsync(cancellationToken);

                // Enrich with the coach's current assignment count (in-module query).
                var counts = await db.CoachAssignments.AsNoTracking()
                    .Where(a => a.ReleasedAtUtc == null)
                    .GroupBy(a => a.CoachId)
                    .Select(g => new { CoachId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(x => x.CoachId, x => x.Count, cancellationToken);

                var items = coaches
                    .Select(c => new CoachView(c.Id, c.DisplayName, c.Username, c.BranchId))
                    .OrderBy(c => c.DisplayName)
                    .ToList();

                return Results.Ok(new
                {
                    items,
                    activeAssignmentCounts = counts,
                });
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Coaching")
            .WithSummary("Active coach accounts with their open assignment counts.");
    }
}
