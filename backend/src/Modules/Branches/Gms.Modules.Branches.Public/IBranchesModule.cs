namespace Gms.Modules.Branches.Public;

public record BranchDto(Guid Id, string NameEn, string NameFa, string? City, string? PhoneNumber, bool IsActive);

/// <summary>
/// Branches module contract. Branch ids may be stored freely in other modules,
/// but branch data must always be resolved through this interface.
/// </summary>
public interface IBranchesModule
{
    Task<IReadOnlyList<BranchDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<BranchDto?> GetAsync(Guid branchId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid branchId, CancellationToken cancellationToken = default);
}
