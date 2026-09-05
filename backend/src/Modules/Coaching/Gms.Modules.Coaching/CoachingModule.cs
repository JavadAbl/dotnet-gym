using Gms.Modules.Coaching.Features;
using Gms.Modules.Coaching.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching;

public static class CoachingModule
{
    /// <summary>Registers the Coaching module. Call once from the API host.</summary>
    public static IServiceCollection AddCoachingModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<CoachingDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.ICoachingModule, CoachingModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapCoachingEndpoints(this IEndpointRouteBuilder app)
    {
        CoachesEndpoint.Map(app);
        AssignmentsEndpoints.Map(app);
        PlansEndpoints.Map(app);
        RecordsEndpoints.Map(app);
        SummaryEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by dashboards in later phases).</summary>
internal sealed class CoachingModuleApi(CoachingDbContext db) : Public.ICoachingModule
{
    public async Task<IReadOnlyList<Public.CoachAssignmentDto>> GetActiveForMemberAsync(
        Guid memberId, CancellationToken cancellationToken = default)
    {
        var assignments = await db.CoachAssignments.AsNoTracking()
            .Where(a => a.MemberId == memberId && a.ReleasedAtUtc == null)
            .OrderByDescending(a => a.AssignedAtUtc)
            .ToListAsync(cancellationToken);
        return assignments.Select(a => a.ToPublicDto()).ToList();
    }
}
