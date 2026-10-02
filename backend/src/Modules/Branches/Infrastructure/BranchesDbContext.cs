using Gms.Modules.Branches.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches.Infrastructure;

public sealed class BranchesDbContext(DbContextOptions<BranchesDbContext> options) : DbContext(options)
{
    public DbSet<Branch> Branches => Set<Branch>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Branch>(e =>
        {
            e.ToTable("Branches");
            e.Property(x => x.Name).HasMaxLength(100).IsRequired();
            e.Property(x => x.Address).HasMaxLength(300);
            e.Property(x => x.Phone).HasMaxLength(24);
            e.Property(x => x.Version).IsConcurrencyToken();
        });
    }
}
