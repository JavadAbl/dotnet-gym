using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

/// <summary>
/// A sales document. Single payment method per receipt (locked decision #5) — cash XOR wallet,
/// never mixed. AmountToman is always positive; <see cref="ReceiptKind"/> carries the direction
/// (purchase charge vs. refund payout) so reporting stays trivial.
/// </summary>
public class Receipt : Entity
{
    public Guid MemberId { get; set; }

    public Guid BranchId { get; set; }

    public Guid MemberPackageId { get; set; }

    public ReceiptKind Kind { get; set; }

    public PaymentMethod PaymentMethod { get; set; }

    public long AmountToman { get; set; }

    public string? Note { get; set; }
}
