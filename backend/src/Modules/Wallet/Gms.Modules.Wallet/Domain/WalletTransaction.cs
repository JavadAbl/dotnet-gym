using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Wallet.Domain;

public enum WalletTransactionKind
{
    TopUp = 1,
    PackagePurchase = 2,
    PackageRefund = 3,
    BuffetPurchase = 4,
}

/// <summary>
/// Append-only wallet ledger row. <see cref="BalanceAfter"/> captures the account balance
/// immediately after this transaction — the ledger invariant audited from Phase 5 onward.
/// <see cref="RelatedReceiptId"/> is a cross-module id (Sales receipt) — no FK by design.
/// </summary>
public class WalletTransaction : Entity
{
    public Guid WalletAccountId { get; set; }

    /// <summary>Signed amount in Toman: positive = credit (top-up/refund), negative = debit (purchase).</summary>
    public long AmountToman { get; set; }

    public WalletTransactionKind Kind { get; set; }

    public long BalanceAfter { get; set; }

    public Guid? RelatedReceiptId { get; set; }

    public string? Note { get; set; }
}
