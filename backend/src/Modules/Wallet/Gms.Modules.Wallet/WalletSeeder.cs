using Gms.Modules.Wallet.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Wallet;

/// <summary>
/// Phase 3 seeds: starter wallet accounts so wallet payments are demoable.
/// Real top-up receipts are the Phase 5 deliverable — these seeds only credit opening balances.
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

            await walletApi.CreditAsync(member.Id, amount, WalletTransactionKinds.TopUp, note: "Opening balance (seed).");
        }
    }
}
