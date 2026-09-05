using Gms.Modules.Catalog.Features;
using Gms.Modules.Catalog.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Catalog;

public static class CatalogModule
{
    /// <summary>Registers the Catalog module. Call once from the API host.</summary>
    public static IServiceCollection AddCatalogModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<CatalogDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.ICatalogModule, CatalogModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        CatalogEndpoints.Map(app);
        ProductEndpoints.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract.</summary>
internal sealed class CatalogModuleApi(CatalogDbContext db) : Public.ICatalogModule
{
    public async Task<IReadOnlyList<Public.ExercisePackageDto>> GetPackagesAsync(CancellationToken cancellationToken = default)
    {
        var packages = await db.Packages.AsNoTracking()
            .Include(p => p.BranchAccess)
            .ToListAsync(cancellationToken);
        return packages.Select(p => p.ToDto()).ToList();
    }

    public async Task<Public.ExercisePackageDto?> GetPackageAsync(Guid packageId, CancellationToken cancellationToken = default)
    {
        var package = await db.Packages.AsNoTracking()
            .Include(p => p.BranchAccess)
            .FirstOrDefaultAsync(p => p.Id == packageId, cancellationToken);
        return package?.ToDto();
    }

    public async Task<bool> IsPackageAvailableInBranchAsync(Guid packageId, Guid branchId, CancellationToken cancellationToken = default) =>
        await db.PackageBranchAccess.AsNoTracking()
            .AnyAsync(a => a.PackageId == packageId && a.BranchId == branchId, cancellationToken);

    public async Task<Public.BuffetProductDto?> GetProductAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        var product = await db.BuffetProducts.AsNoTracking()
            .Include(p => p.Prices)
            .FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        return product?.ToDto();
    }

    public async Task<IReadOnlyList<Public.BuffetProductDto>> GetProductsAsync(CancellationToken cancellationToken = default)
    {
        var products = await db.BuffetProducts.AsNoTracking()
            .Include(p => p.Prices)
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return products.Select(p => p.ToDto()).ToList();
    }
}
