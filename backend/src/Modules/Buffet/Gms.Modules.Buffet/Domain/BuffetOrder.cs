using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Buffet.Domain;

/// <summary>Single payment method per receipt (locked decision #5) — cash XOR wallet.</summary>
public enum BuffetPaymentMethod
{
    Cash = 1,
    Wallet = 2,
}

/// <summary>
/// A buffet POS order. MemberId / BranchId / ReceiptId are cross-module ids (no FKs by design)
/// — members resolve via <c>IMembersModule</c>, branches via <c>IBranchesModule</c> and the
/// money document via the Sales receipt linked by <see cref="ReceiptId"/>.
/// No inventory tracking (locked decision #7).
/// </summary>
public class BuffetOrder : Entity
{
    public Guid MemberId { get; set; }

    public Guid BranchId { get; set; }

    public BuffetPaymentMethod PaymentMethod { get; set; }

    /// <summary>Order total in integer Toman — computed server-side from the priced items.</summary>
    public long TotalToman { get; set; }

    /// <summary>Sales receipt (Kind = BuffetPurchase) — linked after creation, no cross-module FK.</summary>
    public Guid? ReceiptId { get; set; }

    public string? Note { get; set; }
}

/// <summary>
/// One line of a buffet order. ProductId is a cross-module id; the product name and unit
/// price are snapshotted at order time so later catalog/price edits never rewrite history.
/// </summary>
public class BuffetOrderItem : Entity
{
    public Guid OrderId { get; set; }

    /// <summary>Catalog product (cross-module id — resolved via <c>ICatalogModule</c> at order time only).</summary>
    public Guid ProductId { get; set; }

    /// <summary>Snapshot of the product name at order time (both locales, display-ready).</summary>
    public string ProductNameEn { get; set; } = default!;

    public string ProductNameFa { get; set; } = default!;

    /// <summary>Per-branch price actually charged (snapshot of BuffetProductPrice at order time).</summary>
    public long UnitPriceToman { get; set; }

    public int Quantity { get; set; }

    public long LineTotalToman { get; set; }
}
