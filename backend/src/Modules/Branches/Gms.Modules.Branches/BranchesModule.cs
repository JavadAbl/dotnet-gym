using Gms.Modules.Branches.Features;
using Gms.Modules.Branches.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches;

public static class BranchesModule
{
    /// <summary>Registers the Branches module. Call once from the API host.</summary>
    public static IServiceCollection AddBranchesModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<BranchesDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IBranchesModule, BranchesModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapBranchEndpoints(this IEndpointRouteBuilder app)
    {
        BranchEndpoints.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract.</summary>
internal sealed class BranchesModuleApi(BranchesDbContext db) : Public.IBranchesModule
{
    public async Task<IReadOnlyList<Public.BranchDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var branches = await db.Branches.AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        return branches.Select(b => b.ToDto()).ToList();
    }

    public async Task<Public.BranchDto?> GetAsync(Guid branchId, CancellationToken cancellationToken = default)
    {
        var branch = await db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == branchId, cancellationToken);
        return branch?.ToDto();
    }

    public async Task<bool> ExistsAsync(Guid branchId, CancellationToken cancellationToken = default) =>
        await db.Branches.AsNoTracking().AnyAsync(b => b.Id == branchId && b.IsActive, cancellationToken);
}
