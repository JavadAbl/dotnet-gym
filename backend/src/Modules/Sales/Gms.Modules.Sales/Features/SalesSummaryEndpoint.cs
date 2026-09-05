using Gms.BuildingBlocks;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>
/// GET /api/v1/sales/summary — workspace KPIs composed from in-module data only (own SQLite
/// file): active member packages, package revenue today with the cash/wallet split, top-ups
/// and refunds today, and month-to-date revenue/refunds. Reception is pinned to its JWT
/// branch; admin sees the whole chain or passes an explicit branchId.
/// </summary>
public static class SalesSummaryEndpoint
{
    public sealed record SalesSummaryResponse(
        int ActivePackages,
        int ActivePrivatePackages,
        long PackageRevenueTodayToman,
        long PackageRevenueCashTodayToman,
        long PackageRevenueWalletTodayToman,
        long TopUpsTodayToman,
        long RefundsTodayToman,
        long PackageRevenueMonthToman,
        long RefundsMonthToman);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/sales/summary", async (
                ClaimsPrincipal user,
                SalesDbContext db,
                Guid? branchId,
                CancellationToken cancellationToken) =>
            {
                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var effectiveBranchId = userBranchId ?? branchId;

                var now = DateTime.UtcNow;
                var todayUtc = now.Date;
                var monthStartUtc = new DateTime(todayUtc.Year, todayUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

                var packages = db.MemberPackages.AsNoTracking()
                    .Where(mp => mp.Status == MemberPackageStatus.Active && mp.ExpiresAtUtc > now);
                var receiptsToday = db.Receipts.AsNoTracking().Where(r => r.CreatedAtUtc >= todayUtc);
                var receiptsMonth = db.Receipts.AsNoTracking().Where(r => r.CreatedAtUtc >= monthStartUtc);

                if (effectiveBranchId is { } branch)
                {
                    packages = packages.Where(mp => mp.BranchId == branch);
                    receiptsToday = receiptsToday.Where(r => r.BranchId == branch);
                    receiptsMonth = receiptsMonth.Where(r => r.BranchId == branch);
                }

                var activePackages = await packages.CountAsync(cancellationToken);
                var activePrivatePackages = await packages
                    .Where(mp => mp.PackageKind == MemberPackageKind.PrivateCoaching)
                    .CountAsync(cancellationToken);
                var packageRevenueTodayToman = await receiptsToday
                    .Where(r => r.Kind == ReceiptKind.PackagePurchase)
                    .SumAsync(r => r.AmountToman, cancellationToken);
                var packageRevenueCashTodayToman = await receiptsToday
                    .Where(r => r.Kind == ReceiptKind.PackagePurchase && r.PaymentMethod == PaymentMethod.Cash)
                    .SumAsync(r => r.AmountToman, cancellationToken);
                var topUpsTodayToman = await receiptsToday
                    .Where(r => r.Kind == ReceiptKind.TopUp)
                    .SumAsync(r => r.AmountToman, cancellationToken);
                var refundsTodayToman = await receiptsToday
                    .Where(r => r.Kind == ReceiptKind.PackageRefund)
                    .SumAsync(r => r.AmountToman, cancellationToken);
                var packageRevenueMonthToman = await receiptsMonth
                    .Where(r => r.Kind == ReceiptKind.PackagePurchase)
                    .SumAsync(r => r.AmountToman, cancellationToken);
                var refundsMonthToman = await receiptsMonth
                    .Where(r => r.Kind == ReceiptKind.PackageRefund)
                    .SumAsync(r => r.AmountToman, cancellationToken);

                return Results.Ok(new SalesSummaryResponse(
                    activePackages,
                    activePrivatePackages,
                    packageRevenueTodayToman,
                    packageRevenueCashTodayToman,
                    packageRevenueTodayToman - packageRevenueCashTodayToman,
                    topUpsTodayToman,
                    refundsTodayToman,
                    packageRevenueMonthToman,
                    refundsMonthToman));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Sales workspace KPIs (active packages incl. private, revenue today/month, payment split, top-ups, refunds).");
    }
}
