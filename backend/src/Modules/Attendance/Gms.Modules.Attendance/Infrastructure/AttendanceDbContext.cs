using Gms.Modules.Attendance.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance.Infrastructure;

public class AttendanceDbContext(DbContextOptions<AttendanceDbContext> options) : DbContext(options)
{
    public DbSet<AttendanceEntry> AttendanceEntries => Set<AttendanceEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AttendanceEntry>(builder =>
        {
            builder.ToTable("AttendanceEntries");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.MemberId).HasColumnName("MemberId");
            builder.Property(e => e.MemberPackageId).HasColumnName("MemberPackageId");
            builder.Property(e => e.BranchId).HasColumnName("BranchId");
            builder.HasIndex(e => e.MemberId);
            builder.HasIndex(e => e.BranchId);
            builder.HasIndex(e => e.CheckInAtUtc);
            // One OPEN entry per member: a member cannot be present twice at once.
            // Partial unique index (SQLite supports filtered indexes).
            builder.HasIndex(e => e.MemberId).IsUnique().HasFilter("CheckOutAtUtc IS NULL");
        });
    }
}
