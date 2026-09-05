using Gms.Modules.Coaching.Domain;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching.Infrastructure;

public class CoachingDbContext(DbContextOptions<CoachingDbContext> options) : DbContext(options)
{
    public DbSet<CoachAssignment> CoachAssignments => Set<CoachAssignment>();
    public DbSet<TrainingPlan> TrainingPlans => Set<TrainingPlan>();
    public DbSet<TrainingRecord> TrainingRecords => Set<TrainingRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CoachAssignment>(builder =>
        {
            builder.ToTable("CoachAssignments");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Note).HasMaxLength(500);
            builder.HasIndex(e => e.CoachId);
            builder.HasIndex(e => e.MemberId);
            builder.HasIndex(e => e.BranchId);
            builder.HasIndex(e => e.AssignedAtUtc);
            // One ACTIVE assignment per coach-member pair (released rows are history).
            // Partial unique index — SQLite supports filtered indexes.
            builder.HasIndex(e => new { e.CoachId, e.MemberId })
                .IsUnique()
                .HasFilter("ReleasedAtUtc IS NULL");
        });

        modelBuilder.Entity<TrainingPlan>(builder =>
        {
            builder.ToTable("TrainingPlans");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Title).HasMaxLength(200).IsRequired();
            builder.Property(e => e.Goal).HasMaxLength(500);
            builder.Property(e => e.Content).HasMaxLength(8000).IsRequired();
            builder.HasIndex(e => e.CoachId);
            builder.HasIndex(e => e.MemberId);
            builder.HasIndex(e => new { e.CoachId, e.MemberId, e.IsActive });
        });

        modelBuilder.Entity<TrainingRecord>(builder =>
        {
            builder.ToTable("TrainingRecords");
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Summary).HasMaxLength(1000).IsRequired();
            builder.Property(e => e.Intensity).HasMaxLength(20);
            builder.Property(e => e.Note).HasMaxLength(1000);
            builder.Property(e => e.MemberPackageId).HasColumnName("MemberPackageId");
            builder.HasIndex(e => e.CoachId);
            builder.HasIndex(e => e.MemberId);
            builder.HasIndex(e => e.BranchId);
            builder.HasIndex(e => e.PerformedAtUtc);
            builder.HasIndex(e => e.MemberPackageId);
        });
    }
}
