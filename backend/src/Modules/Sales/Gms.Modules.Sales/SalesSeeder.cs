using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales;

/// <summary>
/// Phase 3 seeds: demo purchases so the sales workspace is not empty on first run —
/// one wallet purchase (ledger-consistent with the Wallet seeds), a frozen package,
/// and a refunded one exercising the full state machine.
/// </summary>
public static class SalesSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.SalesDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.MemberPackages.AnyAsync())
        {
            return;
        }

        // Cross-module data resolved exclusively through public contracts (module rule #1).
        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var catalogApi = scope.ServiceProvider.GetRequiredService<ICatalogModule>();
        var membersApi = scope.ServiceProvider.GetRequiredService<IMembersModule>();
        var walletApi = scope.ServiceProvider.GetRequiredService<IWalletModule>();

        var branches = await branchesApi.GetAllAsync();
        var packages = await catalogApi.GetPackagesAsync();
        if (branches.Count == 0 || packages.Count == 0)
        {
            return; // branches and catalog must be seeded first (see Program.cs boot order)
        }

        var north = branches.First(b => b.NameEn == "North Branch").Id;
        var south = branches.First(b => b.NameEn == "South Branch").Id;
        var vip = packages.First(p => p.NameEn.StartsWith("VIP", StringComparison.Ordinal));
        var basic = packages.First(p => p.NameEn.StartsWith("Basic", StringComparison.Ordinal));

        var ali = await membersApi.GetByCardCodeAsync("RF-0001");
        var sara = await membersApi.GetByCardCodeAsync("RF-0002");
        var reza = await membersApi.GetByCardCodeAsync("RF-0003");
        var maryam = await membersApi.GetByCardCodeAsync("RF-0004");
        if (ali is null || sara is null || reza is null || maryam is null)
        {
            return; // members must be seeded first
        }

        var now = DateTime.UtcNow;

        // ---------------------------------------------------------------- 1. Ali — VIP @ North, WALLET (ledger stays consistent)
        var aliVip = new MemberPackage
        {
            MemberId = ali.Id, PackageId = vip.Id, BranchId = north,
            SessionsTotal = vip.SessionsCount, SessionsUsed = 3,
            StartedAtUtc = now.AddDays(-6), ExpiresAtUtc = now.AddDays(-6).AddDays(vip.DurationDays),
            PricePaidToman = vip.PriceToman,
        };
        var aliVipReceipt = new Receipt
        {
            MemberId = ali.Id, BranchId = north, MemberPackageId = aliVip.Id,
            Kind = ReceiptKind.PackagePurchase, PaymentMethod = PaymentMethod.Wallet,
            AmountToman = vip.PriceToman, CreatedAtUtc = now.AddDays(-6),
        };
        aliVip.CreatedAtUtc = now.AddDays(-6);
        // Debit first (Wallet seeds topped up 5,000,000 for RF-0001 → balance 2,500,000 after this).
        await walletApi.DebitAsync(
            ali.Id, vip.PriceToman, WalletTransactionKinds.PackagePurchase,
            aliVipReceipt.Id, "Package purchase: VIP (seed).");
        db.MemberPackages.Add(aliVip);
        db.Receipts.Add(aliVipReceipt);

        // ---------------------------------------------------------------- 2. Sara — Basic @ South, cash, in progress
        var saraBasic = new MemberPackage
        {
            MemberId = sara.Id, PackageId = basic.Id, BranchId = south,
            SessionsTotal = basic.SessionsCount, SessionsUsed = 2,
            StartedAtUtc = now.AddDays(-4), ExpiresAtUtc = now.AddDays(-4).AddDays(basic.DurationDays),
            PricePaidToman = basic.PriceToman,
            CreatedAtUtc = now.AddDays(-4),
        };
        db.MemberPackages.Add(saraBasic);
        db.Receipts.Add(new Receipt
        {
            MemberId = sara.Id, BranchId = south, MemberPackageId = saraBasic.Id,
            Kind = ReceiptKind.PackagePurchase, PaymentMethod = PaymentMethod.Cash,
            AmountToman = basic.PriceToman, CreatedAtUtc = now.AddDays(-4),
        });

        // ---------------------------------------------------------------- 3. Reza — VIP @ South, cash, FROZEN (2 days ago)
        var rezaVip = new MemberPackage
        {
            MemberId = reza.Id, PackageId = vip.Id, BranchId = south,
            SessionsTotal = vip.SessionsCount, SessionsUsed = 5,
            StartedAtUtc = now.AddDays(-20), ExpiresAtUtc = now.AddDays(-20).AddDays(vip.DurationDays),
            Status = MemberPackageStatus.Frozen,
            PricePaidToman = vip.PriceToman,
            CreatedAtUtc = now.AddDays(-20),
        };
        rezaVip.Freezes.Add(new PackageFreeze
        {
            MemberPackageId = rezaVip.Id,
            FrozenAtUtc = now.AddDays(-2),
            CreatedAtUtc = now.AddDays(-2),
        });
        db.MemberPackages.Add(rezaVip);
        db.Receipts.Add(new Receipt
        {
            MemberId = reza.Id, BranchId = south, MemberPackageId = rezaVip.Id,
            Kind = ReceiptKind.PackagePurchase, PaymentMethod = PaymentMethod.Cash,
            AmountToman = vip.PriceToman, CreatedAtUtc = now.AddDays(-20),
        });

        // ---------------------------------------------------------------- 4. Maryam — VIP @ North, cash, in progress
        var maryamVip = new MemberPackage
        {
            MemberId = maryam.Id, PackageId = vip.Id, BranchId = north,
            SessionsTotal = vip.SessionsCount, SessionsUsed = 3,
            StartedAtUtc = now.AddDays(-10), ExpiresAtUtc = now.AddDays(-10).AddDays(vip.DurationDays),
            PricePaidToman = vip.PriceToman,
            CreatedAtUtc = now.AddDays(-10),
        };
        db.MemberPackages.Add(maryamVip);
        db.Receipts.Add(new Receipt
        {
            MemberId = maryam.Id, BranchId = north, MemberPackageId = maryamVip.Id,
            Kind = ReceiptKind.PackagePurchase, PaymentMethod = PaymentMethod.Cash,
            AmountToman = vip.PriceToman, CreatedAtUtc = now.AddDays(-10),
        });

        // ---------------------------------------------------------------- 5. Ali — Basic @ South, cash, REFUNDED (pro-rata 5/8)
        var aliBasic = new MemberPackage
        {
            MemberId = ali.Id, PackageId = basic.Id, BranchId = south,
            SessionsTotal = basic.SessionsCount, SessionsUsed = 3,
            StartedAtUtc = now.AddDays(-40), ExpiresAtUtc = now.AddDays(-40).AddDays(basic.DurationDays),
            Status = MemberPackageStatus.Refunded,
            PricePaidToman = basic.PriceToman,
            CreatedAtUtc = now.AddDays(-40),
        };
        var aliBasicRefund = new Refund
        {
            MemberPackageId = aliBasic.Id,
            AmountToman = basic.PriceToman * (basic.SessionsCount - 3) / basic.SessionsCount, // 1,200,000 × 5/8 = 750,000
            Reason = "Member relocated (seed).",
            RefundedAtUtc = now.AddDays(-38),
            CreatedAtUtc = now.AddDays(-38),
        };
        db.MemberPackages.Add(aliBasic);
        db.Refunds.Add(aliBasicRefund);
        db.Receipts.Add(new Receipt
        {
            MemberId = ali.Id, BranchId = south, MemberPackageId = aliBasic.Id,
            Kind = ReceiptKind.PackagePurchase, PaymentMethod = PaymentMethod.Cash,
            AmountToman = basic.PriceToman, CreatedAtUtc = now.AddDays(-40),
        });
        db.Receipts.Add(new Receipt
        {
            MemberId = ali.Id, BranchId = south, MemberPackageId = aliBasic.Id,
            Kind = ReceiptKind.PackageRefund, PaymentMethod = PaymentMethod.Cash,
            AmountToman = aliBasicRefund.AmountToman, Note = aliBasicRefund.Reason,
            CreatedAtUtc = now.AddDays(-38),
        });

        await db.SaveChangesAsync();
    }
}
