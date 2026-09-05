using Gms.BuildingBlocks;
using Gms.Modules.Buffet.Domain;
using Gms.Modules.Buffet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet.Features;

/// <summary>
/// GET /api/v1/buffet/summary — counter KPIs for today (UTC): order count, revenue and the
/// cash/wallet split. Reception/buffet are pinned to their own branch (JWT claim); admin sees
/// the whole chain or passes an explicit branchId.
/// </summary>
public static class SummaryEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/buffet/summary", async (
                ClaimsPrincipal user,
                BuffetDbContext db,
                Guid? branchId,
                CancellationToken cancellationToken) =>
            {
                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var effectiveBranchId = userBranchId ?? branchId;

                var todayUtc = DateTime.UtcNow.Date;
                var query = db.Orders.AsNoTracking().Where(o => o.CreatedAtUtc >= todayUtc);
                if (effectiveBranchId is { } branchFilter)
                {
                    query = query.Where(o => o.BranchId == branchFilter);
                }

                var ordersToday = await query.CountAsync(cancellationToken);
                var revenueTodayToman = await query.SumAsync(o => o.TotalToman, cancellationToken);
                var cashRevenueTodayToman = await query
                    .Where(o => o.PaymentMethod == BuffetPaymentMethod.Cash)
                    .SumAsync(o => o.TotalToman, cancellationToken);
                var walletRevenueTodayToman = revenueTodayToman - cashRevenueTodayToman;

                return Results.Ok(new BuffetSummary(
                    ordersToday, revenueTodayToman, cashRevenueTodayToman, walletRevenueTodayToman));
            })
            .RequireAuthorization(Policies.Counter)
            .WithTags("Buffet")
            .WithSummary("Buffet counter KPIs for today (orders, revenue, cash/wallet split).");
    }
}
