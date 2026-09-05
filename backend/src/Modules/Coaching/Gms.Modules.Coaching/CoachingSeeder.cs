using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Coaching.Domain;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Coaching;

/// <summary>
/// Phase 6 seeds: demo coach assignments, training plans and records so the coach
/// workspace is alive on first run. Cross-module data (coaches, members, branches) is
/// resolved exclusively through the public contracts (module rule #1). Run after the
/// Attendance seeder (needs the demo members, which must exist before assignments).
/// v2 — seeded records are linked to the members' private-coach packages (created by
/// the Sales seeder with matching SessionsUsed counters) via the Sales contract.
/// </summary>
public static class CoachingSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.CoachingDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.CoachAssignments.AnyAsync())
        {
            return;
        }

        var identityApi = scope.ServiceProvider.GetRequiredService<IIdentityModule>();
        var membersApi = scope.ServiceProvider.GetRequiredService<IMembersModule>();
        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var salesApi = scope.ServiceProvider.GetRequiredService<ISalesModule>();

        var coaches = await identityApi.GetCoachesAsync();
        if (coaches.Count == 0)
        {
            return; // identity must be seeded first (see Program.cs boot order)
        }

        var branches = await branchesApi.GetAllAsync();
        var north = branches.FirstOrDefault(b => b.NameEn == "North Branch")?.Id;
        var south = branches.FirstOrDefault(b => b.NameEn == "South Branch")?.Id;
        if (north is null || south is null)
        {
            return; // branches must be seeded first
        }

        var coachNorth = coaches.FirstOrDefault(c => c.Username == "coach.north");
        var coachSouth = coaches.FirstOrDefault(c => c.Username == "coach.south");
        if (coachNorth is null)
        {
            return; // coach accounts must exist
        }

        var ali = await membersApi.GetByCardCodeAsync("RF-0001");
        var sara = await membersApi.GetByCardCodeAsync("RF-0002");
        var maryam = await membersApi.GetByCardCodeAsync("RF-0004");
        if (ali is null || sara is null || maryam is null)
        {
            return; // members must be seeded first
        }

        var now = DateTime.UtcNow;

        // ------------------------------------------------- 1. coach.north → Ali @ North (active)
        var aliAssignment = new CoachAssignment
        {
            CoachId = coachNorth.Id,
            MemberId = ali.Id,
            BranchId = north.Value,
            AssignedAtUtc = now.AddDays(-21),
            Note = "Strength focus — 3 sessions / week.",
            CreatedAtUtc = now.AddDays(-21),
        };

        // ------------------------------------------------- 2. coach.north → Maryam @ North (active)
        var maryamAssignment = new CoachAssignment
        {
            CoachId = coachNorth.Id,
            MemberId = maryam.Id,
            BranchId = north.Value,
            AssignedAtUtc = now.AddDays(-10),
            Note = "Postpartum comeback — light intensity.",
            CreatedAtUtc = now.AddDays(-10),
        };

        // ------------------------------------------------- 3. coach.south → Sara @ South (released — history demo)
        CoachAssignment? saraAssignment = null;
        if (coachSouth is not null)
        {
            saraAssignment = new CoachAssignment
            {
                CoachId = coachSouth.Id,
                MemberId = sara.Id,
                BranchId = south.Value,
                AssignedAtUtc = now.AddDays(-30),
                ReleasedAtUtc = now.AddDays(-12),
                Note = "Moved to the North site (seed).",
                CreatedAtUtc = now.AddDays(-30),
            };
        }

        db.CoachAssignments.AddRange(aliAssignment, maryamAssignment);
        if (saraAssignment is not null)
        {
            db.CoachAssignments.Add(saraAssignment);
        }

        // ------------------------------------------------- plans (require the assignments above)
        var aliPlanV1 = new TrainingPlan
        {
            CoachId = coachNorth.Id,
            MemberId = ali.Id,
            Title = "Hypertrophy — Month 1",
            Goal = "Add 2kg lean mass; fix squat depth.",
            Content = """
                Mon — Upper push: bench 4×8, incline DB 3×10, dips 3×8.
                Wed — Lower: squat 5×5 @ 80kg, RDL 3×10, calf raises 4×15.
                Fri — Upper pull: rows 4×8, lat pulldown 3×10, face pulls 3×15.
                Progression: +2.5kg when all sets hit target reps.
                """,
            IsActive = false,
            ArchivedAtUtc = now.AddDays(-7),
            CreatedAtUtc = now.AddDays(-21),
        };

        var aliPlanV2 = new TrainingPlan
        {
            CoachId = coachNorth.Id,
            MemberId = ali.Id,
            Title = "Hypertrophy — Month 2",
            Goal = "Push squat to 90kg; add pull-up volume.",
            Content = """
                Mon — Upper push: bench 5×5, OH press 3×8, dips 3×10.
                Wed — Lower: squat 5×5 @ 85kg, front squat 3×8, hip thrust 3×10.
                Fri — Upper pull: weighted pull-ups 5×5, rows 4×10, curls 3×12.
                Progression: linear +2.5kg/week on the big lifts.
                """,
            IsActive = true,
            CreatedAtUtc = now.AddDays(-7),
        };

        var maryamPlan = new TrainingPlan
        {
            CoachId = coachNorth.Id,
            MemberId = maryam.Id,
            Title = "Foundation — Mobility & Core",
            Goal = "Rebuild core stability; pain-free full range.",
            Content = """
                Tue — Mobility flow 20' + dead bug 3×10, bird dog 3×10.
                Thu — Goblet squat 3×12, band rows 3×15, plank 3×30s.
                Sat — Walk 30' + stretching.
                Rule: stop before form breaks; no max loads this month.
                """,
            IsActive = true,
            CreatedAtUtc = now.AddDays(-9),
        };

        db.TrainingPlans.AddRange(aliPlanV1, aliPlanV2, maryamPlan);

        // ------------------------------------------------- records (sessions the members actually did)
        // v2 — every record is paid from the member's private-coach package (Sales seeder created
        // them with SessionsUsed matching this history); resolved via the Sales public contract.
        var privatePackages = (await salesApi.GetActivePrivatePackagesAsync([ali.Id, maryam.Id]))
            .ToDictionary(p => p.MemberId);
        var aliPrivatePackageId = privatePackages.TryGetValue(ali.Id, out var aliPrivate) ? aliPrivate.Id : (Guid?)null;
        var maryamPrivatePackageId = privatePackages.TryGetValue(maryam.Id, out var maryamPrivate) ? maryamPrivate.Id : (Guid?)null;

        db.TrainingRecords.AddRange(
            new TrainingRecord
            {
                CoachId = coachNorth.Id,
                MemberId = ali.Id,
                TrainingPlanId = aliPlanV2.Id,
                MemberPackageId = aliPrivatePackageId,
                BranchId = north.Value,
                PerformedAtUtc = now.AddDays(-2).AddHours(-2),
                Summary = "Lower — squat 5×5 @ 85kg (all clean), RDL 3×10 @ 70kg.",
                DurationMinutes = 55,
                Intensity = "High",
                CreatedAtUtc = now.AddDays(-2),
            },
            new TrainingRecord
            {
                CoachId = coachNorth.Id,
                MemberId = ali.Id,
                TrainingPlanId = aliPlanV2.Id,
                MemberPackageId = aliPrivatePackageId,
                BranchId = north.Value,
                PerformedAtUtc = now.AddDays(-4).AddHours(-3),
                Summary = "Upper pull — weighted pull-up 5×5 +10kg, rows 4×10.",
                DurationMinutes = 50,
                Intensity = "Medium",
                CreatedAtUtc = now.AddDays(-4),
            },
            new TrainingRecord
            {
                CoachId = coachNorth.Id,
                MemberId = ali.Id,
                TrainingPlanId = aliPlanV1.Id,
                MemberPackageId = aliPrivatePackageId,
                BranchId = north.Value,
                PerformedAtUtc = now.AddDays(-9).AddHours(-1),
                Summary = "Month 1 test day — squat 80kg 5×5, depth fixed.",
                DurationMinutes = 60,
                Intensity = "Medium",
                CreatedAtUtc = now.AddDays(-9),
            },
            new TrainingRecord
            {
                CoachId = coachNorth.Id,
                MemberId = maryam.Id,
                TrainingPlanId = maryamPlan.Id,
                MemberPackageId = maryamPrivatePackageId,
                BranchId = north.Value,
                PerformedAtUtc = now.AddDays(-1).AddHours(-4),
                Summary = "Mobility + core — plank 3×30s, pain-free.",
                DurationMinutes = 40,
                Intensity = "Low",
                CreatedAtUtc = now.AddDays(-1),
            },
            new TrainingRecord
            {
                CoachId = coachNorth.Id,
                MemberId = maryam.Id,
                TrainingPlanId = maryamPlan.Id,
                MemberPackageId = maryamPrivatePackageId,
                BranchId = north.Value,
                PerformedAtUtc = now.AddDays(-3).AddHours(-5),
                Summary = "Goblet squat 3×12 @ 8kg, band rows 3×15.",
                DurationMinutes = 35,
                Intensity = "Low",
                CreatedAtUtc = now.AddDays(-3),
            });

        await db.SaveChangesAsync();
    }
}
