namespace Gms.Modules.Sales.Public;

/// <summary>Member-package snapshot shared across modules (Attendance, Coaching, dashboards).</summary>
public record MemberPackageDto(
    Guid Id,
    Guid MemberId,
    Guid PackageId,
    Guid BranchId,
    string PackageKind,
    int SessionsTotal,
    int SessionsUsed,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc,
    string Status,
    long PricePaidToman);

/// <summary>Outcome of an atomic private-coaching session consumption (v2): which package paid, and its live counters.</summary>
public record CoachingSessionConsumedDto(Guid MemberPackageId, int SessionsTotal, int SessionsUsed);

/// <summary>Result of a top-up receipt creation (Wallet module links its ledger row to the receipt id).</summary>
public record ReceiptCreatedDto(Guid ReceiptId, long AmountToman, DateTime CreatedAtUtc);

/// <summary>
/// Sales module contract. Other modules store member-package ids but resolve package data
/// exclusively through this interface (no FKs, no JOINs across module databases).
/// </summary>
public interface ISalesModule
{
    Task<MemberPackageDto?> GetMemberPackageAsync(Guid memberPackageId, CancellationToken cancellationToken = default);

    /// <summary>All package instances of a member (any status), newest first.</summary>
    Task<IReadOnlyList<MemberPackageDto>> GetForMemberAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Atomic session consumption for the attendance gate (Phase 4):
    /// <c>UPDATE ... SET SessionsUsed = SessionsUsed + 1 WHERE Id = @id AND Status = Active
    /// AND ExpiresAtUtc &gt; now AND SessionsUsed &lt; SessionsTotal</c>.
    /// True (and only then) exactly one row was consumed. Callers must only pass EXERCISE-kind
    /// packages — gym entry never burns private-coaching sessions (v2).
    /// </summary>
    Task<bool> TryConsumeSessionAsync(Guid memberPackageId, CancellationToken cancellationToken = default);

    /// <summary>
    /// v2 — atomic private-coaching session consumption for the Coaching gate: picks the member's
    /// usable PrivateCoaching package (Active, not expired, sessions remaining — soonest expiry
    /// first) and consumes one session with a single conditional UPDATE. Pre-validation is UX
    /// only; the UPDATE is the source of truth. Null ⇒ nothing was consumed (no usable package,
    /// or a concurrent consumer won the last session).
    /// </summary>
    Task<CoachingSessionConsumedDto?> TryConsumeCoachingSessionAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>
    /// v2 — the best (soonest-expiring) usable PrivateCoaching package per requested member:
    /// status Active, not expired, sessions remaining. Members without one are simply absent
    /// from the result. Used by Coaching to gate assignments and enrich lists with live counters.
    /// </summary>
    Task<IReadOnlyList<MemberPackageDto>> GetActivePrivatePackagesAsync(
        IReadOnlyList<Guid> memberIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Phase 5: records a wallet cash-in as a <c>TopUp</c> receipt — the universal money document
    /// (payment method Cash by definition: banknotes enter the drawer, value enters the wallet).
    /// Amount must be a positive integer Toman. The caller (Wallet module) credits the wallet and
    /// links its ledger row to <see cref="ReceiptCreatedDto.ReceiptId"/>.
    /// Throws <c>wallet.invalid_amount</c> (400) on non-positive amounts.
    /// </summary>
    Task<ReceiptCreatedDto> CreateTopUpReceiptAsync(
        Guid memberId, Guid branchId, long amountToman, string? note = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Phase 7: records a buffet POS order as a <c>BuffetPurchase</c> receipt — the universal
    /// money document (single payment method per receipt, locked decision #5; no member package
    /// is tied to it). Amount must be a positive integer Toman. The caller (Buffet module)
    /// links the order (and, for wallet payments, the wallet ledger row) to the receipt id.
    /// Throws <c>validation.failed</c> (400) on non-positive amounts or unknown payment methods.
    /// </summary>
    Task<ReceiptCreatedDto> CreateBuffetReceiptAsync(
        Guid memberId, Guid branchId, long amountToman, string paymentMethod, string? note = null, CancellationToken cancellationToken = default);
}
