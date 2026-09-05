using Microsoft.EntityFrameworkCore;

namespace Gms.Api.Infrastructure.Auditing;

/// <summary>
/// Audit trail store — its own SQLite file (gms-audit.db), following the one-database-per-concern
/// convention of the modular monolith. Lives in the API host (not BuildingBlocks, not a business
/// module): auditing is host-level cross-cutting infrastructure, and the host is the only place
/// that sees every module's traffic.
/// </summary>
public class AuditDbContext(DbContextOptions<AuditDbContext> options) : DbContext(options)
{
    public DbSet<AuditRecord> AuditRecords => Set<AuditRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuditRecord>(builder =>
        {
            builder.ToTable("AuditRecords");
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).ValueGeneratedOnAdd();
            builder.Property(r => r.Username).HasMaxLength(128);
            builder.Property(r => r.Role).HasMaxLength(32);
            builder.Property(r => r.Action).IsRequired().HasMaxLength(16);
            builder.Property(r => r.Path).IsRequired().HasMaxLength(256);
            builder.Property(r => r.RemoteIp).HasMaxLength(64);
            builder.Property(r => r.Body).HasMaxLength(4000);
            builder.HasIndex(r => r.OccurredAtUtc);
            builder.HasIndex(r => r.UserId);
        });
    }
}
