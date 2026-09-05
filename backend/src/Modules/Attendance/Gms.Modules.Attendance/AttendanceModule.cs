using Gms.Modules.Attendance.Features;
using Gms.Modules.Attendance.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance;

public static class AttendanceModule
{
    /// <summary>Registers the Attendance module. Call once from the API host.</summary>
    public static IServiceCollection AddAttendanceModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<AttendanceDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IAttendanceModule, AttendanceModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        CheckInEndpoint.Map(app);
        CheckOutEndpoint.Map(app);
        PresenceEndpoint.Map(app);
        SearchAttendanceEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by Coaching and dashboards).</summary>
internal sealed class AttendanceModuleApi(AttendanceDbContext db) : Public.IAttendanceModule
{
    public async Task<bool> IsMemberPresentAsync(Guid memberId, CancellationToken cancellationToken = default) =>
        await db.AttendanceEntries.AsNoTracking()
            .AnyAsync(e => e.MemberId == memberId && e.CheckOutAtUtc == null, cancellationToken);

    public async Task<IReadOnlyList<Public.AttendanceEntryDto>> GetForMemberAsync(
        Guid memberId, int limit = 20, CancellationToken cancellationToken = default)
    {
        var entries = await db.AttendanceEntries.AsNoTracking()
            .Where(e => e.MemberId == memberId)
            .OrderByDescending(e => e.CheckInAtUtc)
            .Take(Math.Clamp(limit, 1, 100))
            .ToListAsync(cancellationToken);
        return entries.Select(e => e.ToPublicDto()).ToList();
    }
}
