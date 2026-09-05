using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>GET /api/v1/sales/member-packages — paged member-package list (admin, reception).</summary>
public static class SearchMemberPackagesEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/sales/member-packages", async (
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                Guid? memberId,
                Guid? branchId,
                string? status,
                string? kind,
                string? search,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                var query = db.MemberPackages.AsNoTracking().AsQueryable();

                if (memberId is { } memberFilter)
                {
                    query = query.Where(mp => mp.MemberId == memberFilter);
                }

                if (branchId is { } branchFilter)
                {
                    query = query.Where(mp => mp.BranchId == branchFilter);
                }

                var parsedStatus = SalesViews.ParseStatus(status);
                if (parsedStatus is { } statusFilter)
                {
                    query = query.Where(mp => mp.Status == statusFilter);
                }

                // v2 — kind filter (Exercise | PrivateCoaching) for the workspace tabs.
                var parsedKind = SalesViews.ParseKind(kind);
                if (parsedKind is { } kindFilter)
                {
                    query = query.Where(mp => mp.PackageKind == kindFilter);
                }

                if (!string.IsNullOrWhiteSpace(search))
                {
                    // Members module owns its data — resolve matching ids through the contract (no JOINs).
                    var memberIds = await members.FindIdsAsync(search, 200, cancellationToken);
                    query = query.Where(mp => memberIds.Contains(mp.MemberId));
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(mp => mp.CreatedAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                var lookup = await SalesViews.LoadLookupAsync(
                    members, catalog, branches, items.Select(mp => mp.MemberId), cancellationToken);
                var now = DateTime.UtcNow;
                var views = items.Select(mp => mp.ToView(lookup, now)).ToList();

                return Results.Ok(new PagedResult<MemberPackageView>(views, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Paged member-package list with member/package/branch enrichment.");
    }
}
