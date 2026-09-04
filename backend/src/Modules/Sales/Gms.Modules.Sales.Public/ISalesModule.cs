namespace Gms.Modules.Sales.Public;

/// <summary>Member-package snapshot shared across modules (Attendance, Coaching, dashboards).</summary>
public record MemberPackageDto(
    Guid Id,
    Guid MemberId,
    Guid PackageId,
    Guid BranchId,
    int SessionsTotal,
    int SessionsUsed,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc,
    string Status,
    long PricePaidToman);

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
    /// True (and only then) exactly one row was consumed.
    /// </summary>
    Task<bool> TryConsumeSessionAsync(Guid memberPackageId, CancellationToken cancellationToken = default);
}
