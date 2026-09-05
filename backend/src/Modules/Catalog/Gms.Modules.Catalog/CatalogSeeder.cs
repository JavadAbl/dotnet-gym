using Gms.Modules.Catalog.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Catalog;

/// <summary>
/// Phase 1 seeds: VIP (both branches) & Basic (South only) exercise packages,
/// plus buffet products with per-branch prices (identical here; different values demonstrate the feature).
/// </summary>
public static class CatalogSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IReadOnlyList<Public.BranchDto> branches)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.CatalogDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.Packages.IgnoreQueryFilters().AnyAsync() || await db.BuffetProducts.IgnoreQueryFilters().AnyAsync())
        {
            return;
        }

        var north = branches.FirstOrDefault(b => b.NameEn == "North Branch")?.Id
            ?? throw new InvalidOperationException("North branch must be seeded before catalog.");
        var south = branches.FirstOrDefault(b => b.NameEn == "South Branch")?.Id
            ?? throw new InvalidOperationException("South branch must be seeded before catalog.");

        var vip = new ExercisePackage
        {
            NameEn = "VIP — 12 Sessions / 1 Month",
            NameFa = "ویژه — ۱۲ جلسه / یک ماه",
            SessionsCount = 12,
            DurationDays = 30,
            PriceToman = 2_500_000,
            BranchAccess = [new PackageBranchAccess { BranchId = north }, new PackageBranchAccess { BranchId = south }],
        };

        var basic = new ExercisePackage
        {
            NameEn = "Basic — 8 Sessions / 2 Weeks",
            NameFa = "پایه — ۸ جلسه / دو هفته",
            SessionsCount = 8,
            DurationDays = 14,
            PriceToman = 1_200_000,
            BranchAccess = [new PackageBranchAccess { BranchId = south }],
        };

        var water = new BuffetProduct { NameEn = "Water 500ml", NameFa = "آب معدنی ۵۰۰ میلی‌لیتر" };
        var proteinBar = new BuffetProduct { NameEn = "Protein Bar", NameFa = "بار پروتئین" };
        var energyDrink = new BuffetProduct { NameEn = "Energy Drink", NameFa = "نوشیدنی انرژی‌زا" };

        water.Prices.Add(new BuffetProductPrice { BranchId = north, PriceToman = 15_000 });
        water.Prices.Add(new BuffetProductPrice { BranchId = south, PriceToman = 15_000 });
        proteinBar.Prices.Add(new BuffetProductPrice { BranchId = north, PriceToman = 85_000 });
        proteinBar.Prices.Add(new BuffetProductPrice { BranchId = south, PriceToman = 95_000 }); // per-branch pricing demo
        energyDrink.Prices.Add(new BuffetProductPrice { BranchId = north, PriceToman = 60_000 });
        energyDrink.Prices.Add(new BuffetProductPrice { BranchId = south, PriceToman = 60_000 });

        db.Packages.AddRange(vip, basic);
        db.BuffetProducts.AddRange(water, proteinBar, energyDrink);
        await db.SaveChangesAsync();
    }
}
