using Gms.BuildingBlocks;
using Gms.Modules.Sales.Features;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales;

public static class SalesModule
{
    /// <summary>Registers the Sales module. Call once from the API host.</summary>
    public static IServiceCollection AddSalesModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<SalesDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.ISalesModule, SalesModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapSalesEndpoints(this IEndpointRouteBuilder app)
    {
        PurchaseMemberPackageEndpoint.Map(app);
        SearchMemberPackagesEndpoint.Map(app);
        GetMemberPackageEndpoint.Map(app);
        FreezeMemberPackageEndpoint.Map(app);
        RefundMemberPackageEndpoint.Map(app);
        ListReceiptsEndpoint.Map(app);
        SalesSummaryEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by Attendance in Phase 4 and dashboards).</summary>
internal sealed class SalesModuleApi(SalesDbContext db) : Public.ISalesModule
{
    public async Task<Public.MemberPackageDto?> GetMemberPackageAsync(
        Guid memberPackageId, CancellationToken cancellationToken = default)
    {
        var memberPackage = await db.MemberPackages.AsNoTracking()
            .FirstOrDefaultAsync(mp => mp.Id == memberPackageId, cancellationToken);
        return memberPackage?.ToPublicDto();
    }

    public async Task<IReadOnlyList<Public.MemberPackageDto>> GetForMemberAsync(
        Guid memberId, CancellationToken cancellationToken = default)
    {
        var packages = await db.MemberPackages.AsNoTracking()
            .Where(mp => mp.MemberId == memberId)
            .OrderByDescending(mp => mp.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return packages.Select(mp => mp.ToPublicDto()).ToList();
    }

    public async Task<bool> TryConsumeSessionAsync(Guid memberPackageId, CancellationToken cancellationToken = default)
    {
        // Atomic consumption (plan §2): one conditional UPDATE — checked rows = 1 ⇒ success.
        var affected = await db.MemberPackages
            .Where(mp => mp.Id == memberPackageId
                && mp.Status == Domain.MemberPackageStatus.Active
                && mp.ExpiresAtUtc > DateTime.UtcNow
                && mp.SessionsUsed < mp.SessionsTotal)
            .ExecuteUpdateAsync(setters => setters.SetProperty(mp => mp.SessionsUsed, mp => mp.SessionsUsed + 1),
                cancellationToken);
        return affected == 1;
    }

    /// <summary>v2 — atomic private-coaching consumption: FEFO candidate pick + guarded UPDATE (source of truth).</summary>
    public async Task<Public.CoachingSessionConsumedDto?> TryConsumeCoachingSessionAsync(
        Guid memberId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        // Pre-validation is UX only — pick the member's soonest-expiring usable private package.
        var candidateId = await db.MemberPackages.AsNoTracking()
            .Where(mp => mp.MemberId == memberId
                && mp.PackageKind == Domain.MemberPackageKind.PrivateCoaching
                && mp.Status == Domain.MemberPackageStatus.Active
                && mp.ExpiresAtUtc > now
                && mp.SessionsUsed < mp.SessionsTotal)
            .OrderBy(mp => mp.ExpiresAtUtc)
            .Select(mp => (Guid?)mp.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (candidateId is null)
        {
            return null; // no usable private package at all
        }

        // ATOMIC consumption: one conditional UPDATE — a concurrent consumer of the last
        // session loses the race here (checked rows = 0 ⇒ null), never overselling.
        var affected = await db.MemberPackages
            .Where(mp => mp.Id == candidateId
                && mp.PackageKind == Domain.MemberPackageKind.PrivateCoaching
                && mp.Status == Domain.MemberPackageStatus.Active
                && mp.ExpiresAtUtc > DateTime.UtcNow
                && mp.SessionsUsed < mp.SessionsTotal)
            .ExecuteUpdateAsync(setters => setters.SetProperty(mp => mp.SessionsUsed, mp => mp.SessionsUsed + 1),
                cancellationToken);

        if (affected != 1)
        {
            return null; // lost the last-session race
        }

        var consumed = await db.MemberPackages.AsNoTracking()
            .Where(mp => mp.Id == candidateId)
            .Select(mp => new Public.CoachingSessionConsumedDto(mp.Id, mp.SessionsTotal, mp.SessionsUsed))
            .FirstAsync(cancellationToken);
        return consumed;
    }

    /// <summary>v2 — best usable private package per member (FEFO), for Coaching gates and list enrichment.</summary>
    public async Task<IReadOnlyList<Public.MemberPackageDto>> GetActivePrivatePackagesAsync(
        IReadOnlyList<Guid> memberIds, CancellationToken cancellationToken = default)
    {
        if (memberIds.Count == 0)
        {
            return [];
        }

        var now = DateTime.UtcNow;
        var usable = await db.MemberPackages.AsNoTracking()
            .Where(mp => memberIds.Contains(mp.MemberId)
                && mp.PackageKind == Domain.MemberPackageKind.PrivateCoaching
                && mp.Status == Domain.MemberPackageStatus.Active
                && mp.ExpiresAtUtc > now
                && mp.SessionsUsed < mp.SessionsTotal)
            .OrderBy(mp => mp.ExpiresAtUtc)
            .ToListAsync(cancellationToken);

        // Soonest-expiring usable private package per member.
        return usable
            .GroupBy(mp => mp.MemberId)
            .Select(group => group.First().ToPublicDto())
            .ToList();
    }

    public async Task<Public.ReceiptCreatedDto> CreateTopUpReceiptAsync(
        Guid memberId, Guid branchId, long amountToman, string? note = null, CancellationToken cancellationToken = default)
    {
        if (amountToman <= 0)
        {
            throw new GmsException(
                ErrorCodes.WalletInvalidAmount,
                "Top-up amount must be a positive integer amount of Toman.",
                400);
        }

        var receipt = new Domain.Receipt
        {
            MemberId = memberId,
            BranchId = branchId,
            MemberPackageId = null, // TopUp receipts are not tied to any exercise package.
            Kind = Domain.ReceiptKind.TopUp,
            PaymentMethod = Domain.PaymentMethod.Cash, // cash-in at the desk by definition.
            AmountToman = amountToman,
            Note = note,
        };

        db.Receipts.Add(receipt);
        await db.SaveChangesAsync(cancellationToken);

        return new Public.ReceiptCreatedDto(receipt.Id, receipt.AmountToman, receipt.CreatedAtUtc);
    }

    /// <summary>Phase 7: buffet POS orders join the universal money document as BuffetPurchase receipts.</summary>
    public async Task<Public.ReceiptCreatedDto> CreateBuffetReceiptAsync(
        Guid memberId, Guid branchId, long amountToman, string paymentMethod, string? note = null, CancellationToken cancellationToken = default)
    {
        if (amountToman <= 0)
        {
            throw new GmsException(
                ErrorCodes.ValidationFailed,
                "Buffet receipt amount must be a positive integer amount of Toman.",
                400);
        }

        var method = SalesViews.ParsePaymentMethod(paymentMethod)
            ?? throw new GmsException(
                ErrorCodes.ValidationFailed,
                "Payment method must be Cash or Wallet.",
                400);

        var receipt = new Domain.Receipt
        {
            MemberId = memberId,
            BranchId = branchId,
            MemberPackageId = null, // buffet orders are not tied to any exercise package.
            Kind = Domain.ReceiptKind.BuffetPurchase,
            PaymentMethod = method.Value,
            AmountToman = amountToman,
            Note = note,
        };

        db.Receipts.Add(receipt);
        await db.SaveChangesAsync(cancellationToken);

        return new Public.ReceiptCreatedDto(receipt.Id, receipt.AmountToman, receipt.CreatedAtUtc);
    }
}
