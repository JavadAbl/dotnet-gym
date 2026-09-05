using Gms.Modules.Sales.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Infrastructure;

public class SalesDbContext(DbContextOptions<SalesDbContext> options) : DbContext(options)
{
    public DbSet<MemberPackage> MemberPackages => Set<MemberPackage>();

    public DbSet<PackageFreeze> PackageFreezes => Set<PackageFreeze>();

    public DbSet<Refund> Refunds => Set<Refund>();

    public DbSet<Receipt> Receipts => Set<Receipt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MemberPackage>(builder =>
        {
            builder.ToTable("MemberPackages");
            builder.HasKey(mp => mp.Id);
            builder.Property(mp => mp.MemberId).HasColumnName("MemberId");
            builder.Property(mp => mp.PackageId).HasColumnName("PackageId");
            builder.Property(mp => mp.BranchId).HasColumnName("BranchId");
            builder.Property(mp => mp.PackageKind).HasConversion<int>();
            builder.Property(mp => mp.Status).HasConversion<int>();
            builder.HasIndex(mp => mp.MemberId);
            builder.HasIndex(mp => mp.Status);
            builder.HasIndex(mp => mp.PackageKind);
            builder.HasIndex(mp => mp.BranchId);
            builder.HasIndex(mp => mp.ExpiresAtUtc);
        });

        modelBuilder.Entity<PackageFreeze>(builder =>
        {
            builder.ToTable("PackageFreezes");
            builder.HasKey(f => f.Id);
            builder.Property(f => f.MemberPackageId).HasColumnName("MemberPackageId");
            builder.HasIndex(f => f.MemberPackageId);
        });

        modelBuilder.Entity<Refund>(builder =>
        {
            builder.ToTable("Refunds");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.MemberPackageId).HasColumnName("MemberPackageId");
            // 1:1 — a member package can be refunded at most once (terminal state).
            builder.HasIndex(r => r.MemberPackageId).IsUnique();
            builder.Property(r => r.Reason).HasMaxLength(500);
        });

        modelBuilder.Entity<Receipt>(builder =>
        {
            builder.ToTable("Receipts");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.MemberId).HasColumnName("MemberId");
            builder.Property(r => r.BranchId).HasColumnName("BranchId");
            builder.Property(r => r.MemberPackageId).HasColumnName("MemberPackageId");
            builder.Property(r => r.Kind).HasConversion<int>();
            builder.Property(r => r.PaymentMethod).HasConversion<int>();
            builder.Property(r => r.Note).HasMaxLength(300);
            builder.HasIndex(r => r.MemberId);
            builder.HasIndex(r => r.MemberPackageId);
            builder.HasIndex(r => r.CreatedAtUtc);
        });
    }
}
