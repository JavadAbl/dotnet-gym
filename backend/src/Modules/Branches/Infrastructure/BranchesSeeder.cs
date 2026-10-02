using Gms.Modules.Branches.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches.Infrastructure;

public static class BranchesSeeder
{
    public static async Task SeedAsync(BranchesDbContext db)
    {
        if (await db.Branches.AnyAsync())
        {
            return;
        }

        db.Branches.AddRange(new Branch { Name = "North" }, new Branch { Name = "South" });
        await db.SaveChangesAsync();
    }
}
