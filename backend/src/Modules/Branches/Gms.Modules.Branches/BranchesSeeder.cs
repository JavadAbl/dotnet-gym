using Gms.Modules.Branches.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches;

/// <summary>Phase 1 seeds: North & South branches.</summary>
public static class BranchesSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.BranchesDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.Branches.AnyAsync())
        {
            return;
        }

        db.Branches.AddRange(
            new Branch { NameEn = "North Branch", NameFa = "شعبه شمال", City = "تهران", PhoneNumber = "021-22000001" },
            new Branch { NameEn = "South Branch", NameFa = "شعبه جنوب", City = "تهران", PhoneNumber = "021-22000002" });

        await db.SaveChangesAsync();
    }
}
