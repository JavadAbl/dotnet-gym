namespace Gms.Modules.Identity.Public;

/// <summary>
/// Contracts other modules may consume from Identity. Implemented by the Identity module
/// in a later phase; kept as the boundary pattern reference for now.
/// </summary>
public interface IIdentityModuleApi
{
    Task<UserSummary?> FindByIdAsync(Guid userId, CancellationToken cancellationToken = default);
}

public sealed record UserSummary(Guid Id, string FullName, IReadOnlyList<string> Roles, Guid? BranchId);
