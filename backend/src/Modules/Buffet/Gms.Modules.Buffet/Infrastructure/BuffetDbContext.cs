using Gms.Modules.Buffet.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet.Infrastructure;

public class BuffetDbContext(DbContextOptions<BuffetDbContext> options) : DbContext(options)
{
    public DbSet<BuffetOrder> Orders => Set<BuffetOrder>();

    public DbSet<BuffetOrderItem> Items => Set<BuffetOrderItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BuffetOrder>(builder =>
        {
            builder.ToTable("BuffetOrders");
            builder.HasKey(o => o.Id);
            builder.Property(o => o.TotalToman).HasConversion<long>();
            builder.Property(o => o.Note).HasMaxLength(512);
            builder.HasIndex(o => o.MemberId);
            builder.HasIndex(o => new { o.BranchId, o.CreatedAtUtc });
        });

        modelBuilder.Entity<BuffetOrderItem>(builder =>
        {
            builder.ToTable("BuffetOrderItems");
            builder.HasKey(i => i.Id);
            builder.Property(i => i.ProductNameEn).IsRequired().HasMaxLength(128);
            builder.Property(i => i.ProductNameFa).IsRequired().HasMaxLength(128);
            builder.Property(i => i.UnitPriceToman).HasConversion<long>();
            builder.Property(i => i.LineTotalToman).HasConversion<long>();
            builder.HasIndex(i => i.OrderId);

            builder.HasOne<BuffetOrder>()
                .WithMany()
                .HasForeignKey(i => i.OrderId) // in-module FK only — items belong to their order
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
