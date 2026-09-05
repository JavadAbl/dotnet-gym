using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance.Features;

/// <summary>GET /api/v1/attendance/presence — live presence board (all staff roles).</summary>
public static class PresenceEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/attendance/presence", async (
                AttendanceDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                ISalesModule sales,
                Guid? branchId,
                CancellationToken cancellationToken) =>
            {
                var now = DateTime.UtcNow;
                var todayUtc = now.Date;

                var query = db.AttendanceEntries.AsNoTracking()
                    .Where(e => e.CheckOutAtUtc == null);
                if (branchId is { } branchFilter)
                {
                    query = query.Where(e => e.BranchId == branchFilter);
                }

                var openEntries = await query
                    .OrderByDescending(e => e.CheckInAtUtc)
                    .ToListAsync(cancellationToken);

                var visitsToday = await db.AttendanceEntries.AsNoTracking()
                    .CountAsync(e => e.CheckInAtUtc >= todayUtc
                        && (branchId == null || e.BranchId == branchId), cancellationToken);

                var lookup = await AttendanceViews.LoadLookupAsync(
                    members, catalog, branches, sales,
                    openEntries.Select(e => e.MemberId),
                    openEntries.Select(e => e.MemberPackageId),
                    cancellationToken);

                var items = openEntries.Select(e => e.ToView(lookup, now)).ToList();
                return Results.Ok(new PresenceBoard(items, items.Count, visitsToday));
            })
            .RequireAuthorization(Policies.Staff)
            .WithTags("Attendance")
            .WithSummary("Live presence board: open visits + today's visit count.");
    }
}
