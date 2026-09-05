using Gms.Modules.Catalog.Domain;

namespace Gms.Modules.Catalog;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS.</summary>
public static class CatalogMappings
{
    public static Public.ExercisePackageDto ToDto(this Domain.ExercisePackage package) =>
        new(
            package.Id,
            package.NameEn,
            package.NameFa,
            package.SessionsCount,
            package.DurationDays,
            package.PriceToman,
            package.IsActive,
            package.BranchAccess.Select(a => a.BranchId).ToList());

    public static Public.BuffetProductDto ToDto(this Domain.BuffetProduct product) =>
        new(
            product.Id,
            product.NameEn,
            product.NameFa,
            product.IsActive,
            product.Prices.Select(p => new Public.BuffetProductPriceDto(p.BranchId, p.PriceToman)).ToList());
}
