namespace Gms.Modules.Catalog.Public;

public record ExercisePackageDto(
    Guid Id,
    string NameEn,
    string NameFa,
    int SessionsCount,
    int DurationDays,
    long PriceToman,
    bool IsActive,
    IReadOnlyList<Guid> BranchIds);

public record BuffetProductPriceDto(Guid BranchId, long PriceToman);

public record BuffetProductDto(
    Guid Id,
    string NameEn,
    string NameFa,
    bool IsActive,
    IReadOnlyList<BuffetProductPriceDto> Prices);

/// <summary>
/// Catalog module contract. Exercise packages are globally defined and priced;
/// only buffet products carry per-branch prices (locked decision #4/#8).
/// </summary>
public interface ICatalogModule
{
    Task<IReadOnlyList<ExercisePackageDto>> GetPackagesAsync(CancellationToken cancellationToken = default);

    Task<ExercisePackageDto?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default);

    Task<bool> IsPackageAvailableInBranchAsync(Guid packageId, Guid branchId, CancellationToken cancellationToken = default);

    Task<BuffetProductDto?> GetProductAsync(Guid productId, CancellationToken cancellationToken = default);

    /// <summary>Phase 7: all buffet products with per-branch prices (admin POS + Buffet seeder).</summary>
    Task<IReadOnlyList<BuffetProductDto>> GetProductsAsync(CancellationToken cancellationToken = default);
}
