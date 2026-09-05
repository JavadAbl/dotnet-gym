using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Buffet.Domain;
using Gms.Modules.Buffet.Infrastructure;
using Gms.Modules.Members.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet.Features;

/// <summary>
/// GET /api/v1/buffet/orders — paged order history for the counter.
/// Reception/buffet are pinned to their own branch (JWT claim); admin sees the whole chain
/// and may filter by branch. Free-text search resolves member ids via the Members contract —
/// never a cross-module JOIN.
/// </summary>
public static class SearchOrdersEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/buffet/orders", async (
                ClaimsPrincipal user,
                BuffetDbContext db,
                IMembersModule members,
                IBranchesModule branches,
                Guid? memberId,
                Guid? branchId,
                string? paymentMethod,
                string? search,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 10;

                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var effectiveBranchId = userBranchId ?? branchId;

                var query = db.Orders.AsNoTracking().AsQueryable();
                if (effectiveBranchId is { } branchFilter)
                {
                    query = query.Where(o => o.BranchId == branchFilter);
                }
                if (memberId is { } memberFilter)
                {
                    query = query.Where(o => o.MemberId == memberFilter);
                }
                if (Enum.TryParse<BuffetPaymentMethod>(paymentMethod, ignoreCase: true, out var methodFilter)
                    && Enum.IsDefined(methodFilter))
                {
                    query = query.Where(o => o.PaymentMethod == methodFilter);
                }

                // Free-text search resolves to member ids through the Members contract.
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchedMemberIds = await members.FindIdsAsync(search.Trim(), cancellationToken);
                    if (searchedMemberIds.Count == 0)
                    {
                        return Results.Ok(new PagedResult<BuffetOrderView>(
                            Array.Empty<BuffetOrderView>(), currentPage, currentPageSize, 0));
                    }

                    query = query.Where(o => searchedMemberIds.Contains(o.MemberId));
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var orders = await query
                    .OrderByDescending(o => o.CreatedAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                var orderIds = orders.Select(o => o.Id).ToList();
                var items = orderIds.Count == 0
                    ? new List<BuffetOrderItem>()
                    : await db.Items.AsNoTracking()
                        .Where(i => orderIds.Contains(i.OrderId))
                        .OrderBy(i => i.CreatedAtUtc)
                        .ToListAsync(cancellationToken);

                var lookup = await BuffetViews.LoadLookupAsync(
                    members, branches, orders.Select(o => o.MemberId), cancellationToken);

                var views = orders
                    .Select(order => order.ToView(
                        lookup,
                        items.Where(i => i.OrderId == order.Id).ToList()))
                    .ToList();

                return Results.Ok(new PagedResult<BuffetOrderView>(views, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Counter)
            .WithTags("Buffet")
            .WithSummary("Paged buffet order history (member search via the Members contract).");
    }
}
