using Gms.BuildingBlocks;
using Gms.Modules.Wallet.Public;

namespace Gms.Modules.Wallet.Features;

/// <summary>Wallet read endpoints. Top-up receipts and the ledger workspace arrive in Phase 5.</summary>
public static class WalletEndpoints
{
    public sealed record WalletSnapshotResponse(
        Guid MemberId,
        bool HasAccount,
        long BalanceToman,
        IReadOnlyList<WalletTransactionDto> RecentTransactions);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/wallet/members/{memberId:guid}", async (
                Guid memberId,
                IWalletModule wallet,
                CancellationToken cancellationToken) =>
            {
                var snapshot = await wallet.GetSnapshotAsync(memberId, cancellationToken);
                var transactions = await wallet.GetRecentTransactionsAsync(memberId, 10, cancellationToken);

                return Results.Ok(new WalletSnapshotResponse(
                    snapshot.MemberId, snapshot.HasAccount, snapshot.BalanceToman, transactions));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Wallet")
            .WithSummary("Wallet snapshot (balance + recent ledger rows) for a member.");
    }
}
