using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

public enum MemberPackageStatus
{
    Active = 0,
    Frozen = 1,
    Refunded = 2,
}

public enum PaymentMethod
{
    Cash = 1,
    Wallet = 2,
}

public enum ReceiptKind
{
    PackagePurchase = 1,
    PackageRefund = 2,

    /// <summary>Wallet cash-in at the desk (Phase 5). Created by the Wallet module through the Sales contract.</summary>
    TopUp = 3,

    /// <summary>Buffet POS order (Phase 7). Created by the Buffet module through the Sales contract; no member package.</summary>
    BuffetPurchase = 4,
}

/// <summary>
/// A member's purchased exercise-package instance.
/// MemberId / PackageId / BranchId are cross-module ids (no FKs by design) — resolved via the
/// Members / Catalog / Branches public contracts. Sessions are consumed atomically by Attendance
/// (Phase 4) through <c>ISalesModule.TryConsumeSessionAsync</c>.
/// </summary>
public class MemberPackage : Entity
{
    public Guid MemberId { get; set; }

    public Guid PackageId { get; set; }

    /// <summary>Branch where the package was sold (and, by v1 policy, where it is used).</summary>
    public Guid BranchId { get; set; }

    public int SessionsTotal { get; set; }

    public int SessionsUsed { get; set; }

    public DateTime StartedAtUtc { get; set; }

    public DateTime ExpiresAtUtc { get; set; }

    public MemberPackageStatus Status { get; set; } = MemberPackageStatus.Active;

    /// <summary>Integer Toman actually charged (locked decision #2). Snapshot of the global price at purchase time.</summary>
    public long PricePaidToman { get; set; }

    public List<PackageFreeze> Freezes { get; set; } = [];

    public Refund? Refund { get; set; }
}
