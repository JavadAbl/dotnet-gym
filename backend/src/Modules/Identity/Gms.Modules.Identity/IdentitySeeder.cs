using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity;

/// <summary>
/// Phase 1 seeds: admin + one operator per role/branch.
/// Operators are linked to branches via the Branches PUBLIC contract (module rule #1).
/// Passwords are seeded for the dev environment only — change on first login in production.
/// </summary>
public static class IdentitySeeder
{
    public const string DefaultAdminPassword = "Admin@123";
    public const string DefaultOperatorPassword = "Operator@123";

    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.IdentityDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.Users.AnyAsync())
        {
            return; // already seeded
        }

        // Resolve branch ids through the public contract (runs after BranchesSeeder in the boot order).
        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var branches = await branchesApi.GetAllAsync();
        var northId = branches.FirstOrDefault(b => b.NameEn == "North Branch")?.Id;
        var southId = branches.FirstOrDefault(b => b.NameEn == "South Branch")?.Id;

        var admin = new AppUser
        {
            Username = "admin",
            PasswordHash = PasswordHasher.Hash(DefaultAdminPassword),
            DisplayName = "System Administrator",
            Role = UserRoles.Admin,
            IsActive = true,
        };

        var receptionNorth = new AppUser
        {
            Username = "reception.north",
            PasswordHash = PasswordHasher.Hash(DefaultOperatorPassword),
            DisplayName = "Reception — North",
            Role = UserRoles.Reception,
            BranchId = northId,
            IsActive = true,
        };

        var receptionSouth = new AppUser
        {
            Username = "reception.south",
            PasswordHash = PasswordHasher.Hash(DefaultOperatorPassword),
            DisplayName = "Reception — South",
            Role = UserRoles.Reception,
            BranchId = southId,
            IsActive = true,
        };

        var buffetNorth = new AppUser
        {
            Username = "buffet.north",
            PasswordHash = PasswordHasher.Hash(DefaultOperatorPassword),
            DisplayName = "Buffet — North",
            Role = UserRoles.Buffet,
            BranchId = northId,
            IsActive = true,
        };

        var coachNorth = new AppUser
        {
            Username = "coach.north",
            PasswordHash = PasswordHasher.Hash(DefaultOperatorPassword),
            DisplayName = "Coach — North",
            Role = UserRoles.Coach,
            BranchId = northId,
            IsActive = true,
        };

        db.Users.AddRange(admin, receptionNorth, receptionSouth, buffetNorth, coachNorth);
        await db.SaveChangesAsync();
    }
}
