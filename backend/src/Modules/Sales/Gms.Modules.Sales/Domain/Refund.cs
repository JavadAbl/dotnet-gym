using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

/// <summary>
/// Cancellation of a member package. The refunded amount defaults to the pro-rata value of the
/// unused sessions; a refund receipt mirrors the ORIGINAL payment method (cash back in cash,
/// wallet refunds are credited back to the member's wallet via the Wallet contract).
/// </summary>
public class Refund : Entity
{
    public Guid MemberPackageId { get; set; }

    public long AmountToman { get; set; }

    public string? Reason { get; set; }

    public DateTime RefundedAtUtc { get; set; }

    public Guid RefundedByUserId { get; set; }
}
