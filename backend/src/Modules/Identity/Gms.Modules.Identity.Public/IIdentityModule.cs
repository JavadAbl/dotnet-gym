namespace Gms.Modules.Identity.Public;

/// <summary>Authenticated operator info exposed to other modules.</summary>
public record AuthUserDto(Guid Id, string Username, string DisplayName, string Role, Guid? BranchId);

/// <summary>
/// Identity module contract. Other modules must resolve users ONLY through this interface —
/// never by referencing the Identity EF layer.
/// </summary>
public interface IIdentityModule
{
    Task<AuthUserDto?> GetAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// All active coach accounts (Phase 6). Other modules store the coach user id but
    /// resolve coach display data exclusively through this interface — never by
    /// referencing the Identity EF layer.
    /// </summary>
    Task<IReadOnlyList<AuthUserDto>> GetCoachesAsync(CancellationToken cancellationToken = default);
}
