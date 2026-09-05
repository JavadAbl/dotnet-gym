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
}
