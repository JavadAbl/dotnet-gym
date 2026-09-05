using Gms.Modules.Sales.Public;
using Gms.Modules.Wallet.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Wallet;

/// <summary>
/// Phase 5 seeds: starter wallet accounts, each backed by a real TopUp receipt (the universal
/// money document — created through the Sales contract) so receipts and the ledger reconcile.
/// Opening balances are resolved through the public contracts (module rule #1).
/// </summary>
public static class WalletSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.WalletDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.WalletAccounts.AnyAsync())
        {
            return;
        }

        var membersApi = scope.ServiceProvider.GetRequiredService<IMembersModule>();
        var walletApi = scope.ServiceProvider.GetRequiredService<IWalletModule>();
        var salesApi = scope.ServiceProvider.GetRequiredService<ISalesModule>();

        // Resolve the demo members seeded in Phase 2 through their card codes (public contract only).
        var openingBalanceByCard = new (string CardCode, long Amount)[]
        {
            ("RF-0001", 5_000_000),
            ("RF-0002", 3_000_000),
            ("RF-0003", 500_000),
            ("RF-0004", 1_000_000),
        };

        foreach (var (cardCode, amount) in openingBalanceByCard)
        {
            var member = await membersApi.GetByCardCodeAsync(cardCode);
            if (member is null)
            {
                continue;
            }

            // Credit → receipt → link: the same orchestration the top-up endpoint performs,
            // so seeded wallets reconcile with the receipts list exactly like real ones.
            var note = "Opening balance (seed).";
            var transactionId = await walletApi.CreditAsync(
                member.Id, amount, WalletTransactionKinds.TopUp, note: note);
            try
            {
                var receipt = await salesApi.CreateTopUpReceiptAsync(
                    member.Id, member.HomeBranchId, amount, note);
                await db.WalletTransactions
                    .Where(t => t.Id == transactionId)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.RelatedReceiptId, receipt.ReceiptId));
            }
            catch
            {
                await walletApi.DebitAsync(
                    member.Id, amount, WalletTransactionKinds.TopUp,
                    note: "Compensation: top-up receipt failed after credit.",
                    cancellationToken: CancellationToken.None);
                throw;
            }
        }
    }
}
