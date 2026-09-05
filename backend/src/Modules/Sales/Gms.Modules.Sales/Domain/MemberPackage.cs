using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

public enum MemberPackageStatus
{
    Active = 0,
    Frozen = 1,
    Refunded = 2,
}

/// <summary>
/// Package family snapshot (v2) — mirrors the Catalog module's PackageKind at purchase time.
/// Exercise packages are consumed by gym check-in (Attendance); PrivateCoaching packages are
/// consumed by personal-training sessions (Coaching). Stored as a snapshot so later catalog
/// edits never rewrite purchase history.
/// </summary>
public enum MemberPackageKind
{
    Exercise = 0,
    PrivateCoaching = 1,
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
/// A member's purchased package instance (Exercise or PrivateCoaching).
/// MemberId / PackageId / BranchId are cross-module ids (no FKs by design) — resolved via the
/// Members / Catalog / Branches public contracts. Exercise sessions are consumed atomically by
/// Attendance (Phase 4) via <c>ISalesModule.TryConsumeSessionAsync</c>; private-coaching sessions
/// are consumed atomically by Coaching (v2) via <c>ISalesModule.TryConsumeCoachingSessionAsync</c>.
/// </summary>
public class MemberPackage : Entity
{
    public Guid MemberId { get; set; }

    public Guid PackageId { get; set; }

    /// <summary>Branch where the package was sold (and, by v1 policy, where it is used).</summary>
    public Guid BranchId { get; set; }

    /// <summary>Package family snapshot (v2) copied from the catalog definition at purchase time.</summary>
    public MemberPackageKind PackageKind { get; set; } = MemberPackageKind.Exercise;

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
