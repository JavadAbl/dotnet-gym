using Gms.Modules.Branches.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches.Infrastructure;

public class BranchesDbContext(DbContextOptions<BranchesDbContext> options) : DbContext(options)
{
    public DbSet<Branch> Branches => Set<Branch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Branch>(builder =>
        {
            builder.ToTable("Branches");
            builder.HasKey(b => b.Id);
            builder.Property(b => b.NameEn).IsRequired().HasMaxLength(128);
            builder.Property(b => b.NameFa).IsRequired().HasMaxLength(128);
            builder.Property(b => b.City).HasMaxLength(64);
            builder.Property(b => b.PhoneNumber).HasMaxLength(32);
        });
    }
}
