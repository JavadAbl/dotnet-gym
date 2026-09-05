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

            // Phase 9 hardening: make the package → branch-access relationship EXPLICIT so the
            // schema is deterministic — the FK lives on the existing PackageId column (cascade)
            // instead of a convention-discovered shadow FK, and EnsureCreated output matches the
            // hand-written Initial migration exactly. In-module FK only (both tables in Catalog).
            builder.HasMany(p => p.BranchAccess)
                .WithOne()
                .HasForeignKey(a => a.PackageId)
                .OnDelete(DeleteBehavior.Cascade);
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

            // Phase 9 hardening: explicit FK on the existing ProductId column (cascade), mirroring
            // the PackageBranchAccess fix — deterministic schema, no shadow FK.
            builder.HasMany(p => p.Prices)
                .WithOne()
                .HasForeignKey(pr => pr.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
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
