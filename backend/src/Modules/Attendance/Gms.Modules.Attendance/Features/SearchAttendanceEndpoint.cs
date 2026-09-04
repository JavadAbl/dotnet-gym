using Gms.BuildingBlocks;
using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance.Features;

/// <summary>GET /api/v1/attendance — paged visit history (admin, reception).</summary>
public static class SearchAttendanceEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/attendance", async (
                AttendanceDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                ISalesModule sales,
                Guid? memberId,
                Guid? branchId,
                string? search,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                var query = db.AttendanceEntries.AsNoTracking().AsQueryable();

                if (memberId is { } memberFilter)
                {
                    query = query.Where(e => e.MemberId == memberFilter);
                }

                if (branchId is { } branchFilter)
                {
                    query = query.Where(e => e.BranchId == branchFilter);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    // Members module owns its data — resolve matching ids through the contract (no JOINs).
                    var memberIds = await members.FindIdsAsync(search, 200, cancellationToken);
                    query = query.Where(e => memberIds.Contains(e.MemberId));
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(e => e.CheckInAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                var lookup = await AttendanceViews.LoadLookupAsync(
                    members, catalog, branches, sales,
                    items.Select(e => e.MemberId),
                    items.Select(e => e.MemberPackageId),
                    cancellationToken);

                var now = DateTime.UtcNow;
                var views = items.Select(e => e.ToView(lookup, now)).ToList();

                return Results.Ok(new PagedResult<AttendanceEntryView>(views, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Attendance")
            .WithSummary("Paged attendance history with member/package/branch enrichment.");
    }
}
