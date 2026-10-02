using Gms.BuildingBlocks.Data;
using Gms.Modules.Branches.Infrastructure;
using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Gms.Api.Infrastructure;

public static class DatabaseInitializer
{
    public static async Task RunAsync(IServiceProvider services, string connectionString)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Gms.DatabaseInitializer");

        SqliteMaintenance.EnsureWal(connectionString);

        var identityDb = provider.GetRequiredService<IdentityDbContext>();
        await identityDb.Database.MigrateAsync();
        await IdentitySeeder.SeedAsync(identityDb, provider.GetRequiredService<PasswordHasher<User>>());

        var branchesDb = provider.GetRequiredService<BranchesDbContext>();
        await branchesDb.Database.MigrateAsync();
        await BranchesSeeder.SeedAsync(branchesDb);

        logger.LogInformation("GMS database migrated and seeded");
    }
}
