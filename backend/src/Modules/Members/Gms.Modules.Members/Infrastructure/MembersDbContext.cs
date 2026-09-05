using Gms.Modules.Members.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Infrastructure;

public class MembersDbContext(DbContextOptions<MembersDbContext> options) : DbContext(options)
{
    public DbSet<Member> Members => Set<Member>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Member>(builder =>
        {
            builder.ToTable("Members");
            builder.HasKey(m => m.Id);
            builder.Property(m => m.Code).IsRequired().HasMaxLength(16);
            builder.HasIndex(m => m.Code).IsUnique();
            builder.Property(m => m.FullName).IsRequired().HasMaxLength(200);
            builder.Property(m => m.PhoneNumber).HasMaxLength(20);
            // Unique only when the phone exists (SQLite supports filtered unique indexes).
            builder.HasIndex(m => m.PhoneNumber).IsUnique().HasFilter("[PhoneNumber] IS NOT NULL AND [PhoneNumber] <> ''");
            builder.Property(m => m.CardCode).HasMaxLength(64);
            builder.HasIndex(m => m.CardCode).IsUnique().HasFilter("[CardCode] IS NOT NULL AND [CardCode] <> ''");
            builder.Property(m => m.Notes).HasMaxLength(1000);
            builder.Property(m => m.Status).HasConversion<int>();
            builder.Property(m => m.Gender).HasConversion<int>();
            builder.Property(m => m.HomeBranchId).HasColumnName("HomeBranchId");
        });
    }
}
