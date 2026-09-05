namespace Gms.Modules.Wallet.Public;

public record WalletSnapshotDto(Guid MemberId, bool HasAccount, long BalanceToman);

public record WalletTransactionDto(
    Guid Id,
    long AmountToman,
    string Kind,
    long BalanceAfter,
    Guid? RelatedReceiptId,
    string? Note,
    DateTime CreatedAtUtc);

/// <summary>Ledger kind strings shared across modules (kept as strings so .Public stays dependency-free).</summary>
public static class WalletTransactionKinds
{
    public const string TopUp = "TopUp";
    public const string PackagePurchase = "PackagePurchase";
    public const string PackageRefund = "PackageRefund";
    public const string BuffetPurchase = "BuffetPurchase";
}

/// <summary>
/// Wallet module contract (minimal core delivered with Phase 3 so Sales can charge wallets).
/// Phase 5 completes it with the top-up receipt flow and the full ledger UI.
/// Money is integer Toman (long); every mutation appends a ledger row with BalanceAfter.
/// </summary>
public interface IWalletModule
{
    Task<WalletSnapshotDto> GetSnapshotAsync(Guid memberId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WalletTransactionDto>> GetRecentTransactionsAsync(
        Guid memberId, int limit = 20, CancellationToken cancellationToken = default);

    /// <summary>Creates the account for the member if it does not exist yet (idempotent).</summary>
    Task EnsureAccountAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Conditionally debits the member's wallet. Throws <c>wallet.account_not_found</c> (404),
    /// <c>wallet.invalid_amount</c> (400) or <c>wallet.insufficient_balance</c> (409).
    /// Returns the created ledger row id (callers may link cross-module documents to it).
    /// </summary>
    Task<Guid> DebitAsync(
        Guid memberId, long amountToman, string kind,
        Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Credits the member's wallet (account is created on first credit).
    /// Returns the created ledger row id (callers may link cross-module documents to it).
    /// </summary>
    Task<Guid> CreditAsync(
        Guid memberId, long amountToman, string kind,
        Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Phase 7: attaches a receipt id to a ledger row created earlier without one
    /// (the Buffet POS flow debits before the Sales receipt exists, then links it —
    /// the same two-step the Wallet top-up performs inside its own module).
    /// </summary>
    Task LinkReceiptAsync(Guid transactionId, Guid receiptId, CancellationToken cancellationToken = default);
}
