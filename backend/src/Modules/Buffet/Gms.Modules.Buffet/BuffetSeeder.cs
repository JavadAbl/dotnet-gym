using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Buffet.Domain;
using Gms.Modules.Buffet.Infrastructure;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet;

/// <summary>
/// Phase 7 seeds: three demo POS orders so the buffet workspace is alive on first run —
/// one wallet order yesterday, one cash and one wallet order today (counter KPIs populated).
/// Cross-module data (members, branches, product prices) is resolved exclusively through the
/// public contracts (module rule #1). Runs last: needs members, catalog and wallet accounts.
/// </summary>
public static class BuffetSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.BuffetDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.Orders.AnyAsync())
        {
            return;
        }

        var membersApi = scope.ServiceProvider.GetRequiredService<IMembersModule>();
        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var catalogApi = scope.ServiceProvider.GetRequiredService<ICatalogModule>();
        var walletApi = scope.ServiceProvider.GetRequiredService<IWalletModule>();
        var salesApi = scope.ServiceProvider.GetRequiredService<ISalesModule>();

        var branches = await branchesApi.GetAllAsync();
        var north = branches.FirstOrDefault(b => b.NameEn == "North Branch")?.Id;
        var south = branches.FirstOrDefault(b => b.NameEn == "South Branch")?.Id;
        if (north is null || south is null)
        {
            return; // branches must be seeded first
        }

        var ali = await membersApi.GetByCardCodeAsync("RF-0001");
        var sara = await membersApi.GetByCardCodeAsync("RF-0002");
        var maryam = await membersApi.GetByCardCodeAsync("RF-0004");
        if (ali is null || sara is null || maryam is null)
        {
            return; // members must be seeded first
        }

        var products = await catalogApi.GetProductsAsync();
        var water = products.FirstOrDefault(p => p.NameEn.StartsWith("Water"));
        var proteinBar = products.FirstOrDefault(p => p.NameEn.StartsWith("Protein"));
        var energy = products.FirstOrDefault(p => p.NameEn.StartsWith("Energy"));
        if (water is null || proteinBar is null || energy is null)
        {
            return; // catalog must be seeded first
        }

        var now = DateTime.UtcNow;

        long PriceOf(BuffetProductDto product, Guid branchId) =>
            product.Prices.FirstOrDefault(p => p.BranchId == branchId)?.PriceToman
            ?? throw new InvalidOperationException($"Product {product.NameEn} has no price for branch {branchId}.");

        async Task<BuffetOrder> CreateOrderAsync(
            MemberPublicDto member, Guid branchId, BuffetPaymentMethod method,
            (BuffetProductDto Product, int Quantity)[] lines, DateTime at, string? note = null)
        {
            var order = new BuffetOrder
            {
                MemberId = member.Id,
                BranchId = branchId,
                PaymentMethod = method,
                TotalToman = lines.Sum(l => checked(PriceOf(l.Product, branchId) * l.Quantity)),
                Note = note,
                CreatedAtUtc = at,
            };

            foreach (var line in lines)
            {
                var unitPrice = PriceOf(line.Product, branchId);
                db.Items.Add(new BuffetOrderItem
                {
                    OrderId = order.Id,
                    ProductId = line.Product.Id,
                    ProductNameEn = line.Product.NameEn,
                    ProductNameFa = line.Product.NameFa,
                    UnitPriceToman = unitPrice,
                    Quantity = line.Quantity,
                    LineTotalToman = checked(unitPrice * line.Quantity),
                    CreatedAtUtc = at,
                });
            }

            if (method == BuffetPaymentMethod.Wallet)
            {
                var transactionId = await walletApi.DebitAsync(
                    member.Id, order.TotalToman, WalletTransactionKinds.BuffetPurchase,
                    note: "Buffet order (seed)", cancellationToken: default);
                var receipt = await salesApi.CreateBuffetReceiptAsync(
                    member.Id, branchId, order.TotalToman, method.ToString(), note ?? "Buffet order (seed)");
                order.ReceiptId = receipt.ReceiptId;
                await walletApi.LinkReceiptAsync(transactionId, receipt.ReceiptId);
            }
            else
            {
                var receipt = await salesApi.CreateBuffetReceiptAsync(
                    member.Id, branchId, order.TotalToman, method.ToString(), note ?? "Buffet order (seed)");
                order.ReceiptId = receipt.ReceiptId;
            }

            db.Orders.Add(order);
            await db.SaveChangesAsync();
            return order;
        }

        // 1) Ali — wallet @ North, yesterday: 2× water + 1× protein bar = 115,000 T.
        await CreateOrderAsync(
            ali, north.Value, BuffetPaymentMethod.Wallet,
            [(water, 2), (proteinBar, 1)],
            now.AddDays(-1).AddHours(-3));

        // 2) Sara — cash @ South, ~90 minutes ago: 1× energy drink + 1× protein bar = 155,000 T.
        await CreateOrderAsync(
            sara, south.Value, BuffetPaymentMethod.Cash,
            [(energy, 1), (proteinBar, 1)],
            now.AddMinutes(-90));

        // 3) Maryam — wallet @ North, 2 hours ago: 1× water = 15,000 T.
        await CreateOrderAsync(
            maryam, north.Value, BuffetPaymentMethod.Wallet,
            [(water, 1)],
            now.AddHours(-2));
    }
}
