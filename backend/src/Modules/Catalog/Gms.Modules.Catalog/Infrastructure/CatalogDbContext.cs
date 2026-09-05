using Gms.Modules.Catalog.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Catalog.Infrastructure;

public class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<ExercisePackage> Packages => Set<ExercisePackage>();

    public DbSet<PackageBranchAccess> PackageBranchAccess => Set<PackageBranchAccess>();

    public DbSet<BuffetProduct> BuffetProducts => Set<BuffetProduct>();

    public DbSet<BuffetProductPrice> BuffetProductPrices => Set<BuffetProductPrice>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ExercisePackage>(builder =>
        {
            builder.ToTable("Packages");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.NameEn).IsRequired().HasMaxLength(128);
            builder.Property(p => p.NameFa).IsRequired().HasMaxLength(128);
            builder.Property(p => p.PriceToman).HasConversion<long>();
        });

        modelBuilder.Entity<PackageBranchAccess>(builder =>
        {
            builder.ToTable("PackageBranchAccess");
            builder.HasKey(a => a.Id);
            builder.HasIndex(a => new { a.PackageId, a.BranchId }).IsUnique();
        });

        modelBuilder.Entity<BuffetProduct>(builder =>
        {
            builder.ToTable("BuffetProducts");
            builder.HasKey(p => p.Id);
            builder.Property(p => p.NameEn).IsRequired().HasMaxLength(128);
            builder.Property(p => p.NameFa).IsRequired().HasMaxLength(128);
        });

        modelBuilder.Entity<BuffetProductPrice>(builder =>
        {
            builder.ToTable("BuffetProductPrices");
            builder.HasKey(p => p.Id);
            builder.HasIndex(p => new { p.ProductId, p.BranchId }).IsUnique();
            builder.Property(p => p.PriceToman).HasConversion<long>();
        });
    }
}
