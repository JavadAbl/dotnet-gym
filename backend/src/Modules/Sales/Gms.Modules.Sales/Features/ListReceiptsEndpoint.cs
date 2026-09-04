using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>GET /api/v1/sales/receipts — paged receipt history (admin, reception).</summary>
public static class ListReceiptsEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/sales/receipts", async (
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                Guid? memberId,
                Guid? branchId,
                string? kind,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                var query = db.Receipts.AsNoTracking().AsQueryable();

                if (memberId is { } memberFilter)
                {
                    query = query.Where(r => r.MemberId == memberFilter);
                }

                if (branchId is { } branchFilter)
                {
                    query = query.Where(r => r.BranchId == branchFilter);
                }

                if (Enum.TryParse<ReceiptKind>(kind, ignoreCase: true, out var kindFilter) && Enum.IsDefined(kindFilter))
                {
                    query = query.Where(r => r.Kind == kindFilter);
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(r => r.CreatedAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                // Enrichment: member names via Members, branch names via Branches, package names
                // resolved through the member packages referenced by the receipts.
                var lookup = await SalesViews.LoadLookupAsync(
                    members, catalog, branches, items.Select(r => r.MemberId), cancellationToken);

                var memberPackageIds = items.Select(r => r.MemberPackageId).Distinct().ToList();
                var packageIdByMemberPackage = memberPackageIds.Count == 0
                    ? new Dictionary<Guid, Guid>()
                    : await db.MemberPackages.AsNoTracking()
                        .Where(mp => memberPackageIds.Contains(mp.Id))
                        .ToDictionaryAsync(mp => mp.Id, mp => mp.PackageId, cancellationToken);

                var views = items.Select(r =>
                {
                    var packageId = packageIdByMemberPackage.GetValueOrDefault(r.MemberPackageId);
                    return new ReceiptView(
                        r.Id,
                        r.MemberId,
                        r.BranchId,
                        r.MemberPackageId,
                        r.Kind.ToString(),
                        r.PaymentMethod.ToString(),
                        r.AmountToman,
                        r.Note,
                        r.CreatedAtUtc,
                        lookup.Members.TryGetValue(r.MemberId, out var member) ? member.Code : "—",
                        lookup.Members.TryGetValue(r.MemberId, out member) ? member.FullName : "—",
                        lookup.Branches.TryGetValue(r.BranchId, out var branch) ? branch.NameEn : "—",
                        lookup.Branches.TryGetValue(r.BranchId, out branch) ? branch.NameFa : "—",
                        lookup.Packages.TryGetValue(packageId, out var package) ? package.NameEn : "—",
                        lookup.Packages.TryGetValue(packageId, out package) ? package.NameFa : "—");
                }).ToList();

                return Results.Ok(new PagedResult<ReceiptView>(views, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Paged receipt history (purchases and refunds).");
    }
}
