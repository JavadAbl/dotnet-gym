using Gms.Modules.Wallet.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Wallet.Infrastructure;

public class WalletDbContext(DbContextOptions<WalletDbContext> options) : DbContext(options)
{
    public DbSet<WalletAccount> WalletAccounts => Set<WalletAccount>();

    public DbSet<WalletTransaction> WalletTransactions => Set<WalletTransaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WalletAccount>(builder =>
        {
            builder.ToTable("WalletAccounts");
            builder.HasKey(a => a.Id);
            builder.Property(a => a.MemberId).HasColumnName("MemberId");
            builder.HasIndex(a => a.MemberId).IsUnique();
        });

        modelBuilder.Entity<WalletTransaction>(builder =>
        {
            builder.ToTable("WalletTransactions");
            builder.HasKey(t => t.Id);
            builder.Property(t => t.WalletAccountId).HasColumnName("WalletAccountId");
            builder.Property(t => t.Kind).HasConversion<int>();
            builder.Property(t => t.Note).HasMaxLength(300);
            builder.HasIndex(t => t.WalletAccountId);
            builder.HasIndex(t => t.RelatedReceiptId);
        });
    }
}
