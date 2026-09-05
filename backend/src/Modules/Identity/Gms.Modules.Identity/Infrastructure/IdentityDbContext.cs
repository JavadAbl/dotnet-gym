using Gms.Modules.Identity.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity.Infrastructure;

public class IdentityDbContext(DbContextOptions<IdentityDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>(builder =>
        {
            builder.ToTable("Users");
            builder.HasKey(u => u.Id);
            builder.Property(u => u.Username).IsRequired().HasMaxLength(64);
            builder.Property(u => u.PasswordHash).IsRequired().HasMaxLength(256);
            builder.Property(u => u.DisplayName).IsRequired().HasMaxLength(128);
            builder.Property(u => u.Role).IsRequired().HasMaxLength(32);
            builder.HasIndex(u => u.Username).IsUnique();
        });
    }
}
