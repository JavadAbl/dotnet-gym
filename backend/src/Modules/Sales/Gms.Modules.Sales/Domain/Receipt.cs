using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

/// <summary>
/// A sales document. Single payment method per receipt (locked decision #5) — cash XOR wallet,
/// never mixed. AmountToman is always positive; <see cref="ReceiptKind"/> carries the direction
/// (purchase charge vs. refund payout) so reporting stays trivial.
/// Since Phase 5 the receipt is the universal money document: <see cref="ReceiptKind.TopUp"/>
/// rows (wallet cash-in, created through the Wallet flow) have no member package —
/// <see cref="MemberPackageId"/> is null for them.
/// </summary>
public class Receipt : Entity
{
    public Guid MemberId { get; set; }

    public Guid BranchId { get; set; }

    /// <summary>Null for TopUp receipts — they are not tied to any exercise package.</summary>
    public Guid? MemberPackageId { get; set; }

    public ReceiptKind Kind { get; set; }

    public PaymentMethod PaymentMethod { get; set; }

    public long AmountToman { get; set; }

    public string? Note { get; set; }
}
