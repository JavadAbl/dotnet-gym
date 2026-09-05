namespace Gms.Modules.Members.Public;

/// <summary>Member snapshot shared with other modules (Sales, Attendance, Coaching, Buffet, Wallet) and the admin UI.</summary>
public record MemberPublicDto(
    Guid Id,
    string Code,
    string FullName,
    string? PhoneNumber,
    string Gender,
    DateTime? BirthDateUtc,
    DateTime JoinDateUtc,
    Guid HomeBranchId,
    string? CardCode,
    string Status,
    string? Notes);

/// <summary>
/// Members module contract. Other modules store member ids but must resolve
/// member data exclusively through this interface (no FKs, no JOINs across modules).
/// </summary>
public interface IMembersModule
{
    Task<MemberPublicDto?> GetAsync(Guid memberId, CancellationToken cancellationToken = default);

    Task<MemberPublicDto?> GetByCardCodeAsync(string cardCode, CancellationToken cancellationToken = default);

    /// <summary>True when the member exists and status is Active (entry gate for Attendance).</summary>
    Task<bool> IsActiveAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>Batch resolve members by id (list enrichment without cross-module JOINs).</summary>
    Task<IReadOnlyList<MemberPublicDto>> GetBatchAsync(
        IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolve member ids matching a free-text term (name / code / phone / card).
    /// Lets other modules filter their own tables by member without JOINing the Members store.
    /// </summary>
    Task<IReadOnlyList<Guid>> FindIdsAsync(string searchTerm, int limit = 50, CancellationToken cancellationToken = default);
}
