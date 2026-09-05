using Gms.Modules.Attendance.Domain;
using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance;

/// <summary>
/// Phase 4 seeds: demo visits so the presence board and history are alive on first run —
/// two members currently in the gym (open entries), plus closed visits from the last days.
/// Cross-module data (members, member packages, branches) is resolved exclusively through
/// the public contracts (module rule #1). Run after SalesSeeder (needs member packages).
/// </summary>
public static class AttendanceSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.AttendanceDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.AttendanceEntries.AnyAsync())
        {
            return;
        }

        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var membersApi = scope.ServiceProvider.GetRequiredService<IMembersModule>();
        var salesApi = scope.ServiceProvider.GetRequiredService<ISalesModule>();

        var branches = await branchesApi.GetAllAsync();
        if (branches.Count == 0)
        {
            return; // branches must be seeded first (see Program.cs boot order)
        }

        var north = branches.First(b => b.NameEn == "North Branch").Id;
        var south = branches.First(b => b.NameEn == "South Branch").Id;

        var ali = await membersApi.GetByCardCodeAsync("RF-0001");
        var sara = await membersApi.GetByCardCodeAsync("RF-0002");
        var maryam = await membersApi.GetByCardCodeAsync("RF-0004");
        if (ali is null || sara is null || maryam is null)
        {
            return; // members must be seeded first
        }

        // Active member packages (resolved through the Sales public contract — no direct DB access).
        // v2 — gym-entry demo visits are paid by EXERCISE packages only (private packages never burn).
        var nowSeed = DateTime.UtcNow;
        var isActiveAndUsable = (Public.MemberPackageDto mp, Guid branchId) =>
            string.Equals(mp.PackageKind, "Exercise", StringComparison.Ordinal)
            && string.Equals(mp.Status, "Active", StringComparison.Ordinal)
            && mp.ExpiresAtUtc > nowSeed
            && mp.SessionsUsed < mp.SessionsTotal
            && mp.BranchId == branchId;

        var maryamPackages = await salesApi.GetForMemberAsync(maryam.Id);
        var saraPackages = await salesApi.GetForMemberAsync(sara.Id);
        var aliPackages = await salesApi.GetForMemberAsync(ali.Id);

        var maryamVip = maryamPackages.FirstOrDefault(mp => isActiveAndUsable(mp, north));
        var saraBasic = saraPackages.FirstOrDefault(mp => isActiveAndUsable(mp, south));
        var aliVip = aliPackages.FirstOrDefault(mp => isActiveAndUsable(mp, north));
        if (maryamVip is null || saraBasic is null || aliVip is null)
        {
            return; // sales must be seeded first
        }

        var now = DateTime.UtcNow;

        // ---------------------------------------------------------------- 1. Maryam — IN THE GYM NOW @ North (open entry, 35 min)
        var maryamEntry = new AttendanceEntry
        {
            MemberId = maryam.Id,
            MemberPackageId = maryamVip.Id,
            BranchId = north,
            CheckInAtUtc = now.AddMinutes(-35),
            CreatedAtUtc = now.AddMinutes(-35),
        };

        // ---------------------------------------------------------------- 2. Sara — IN THE GYM NOW @ South (open entry, 12 min)
        var saraEntry = new AttendanceEntry
        {
            MemberId = sara.Id,
            MemberPackageId = saraBasic.Id,
            BranchId = south,
            CheckInAtUtc = now.AddMinutes(-12),
            CreatedAtUtc = now.AddMinutes(-12),
        };

        // ---------------------------------------------------------------- 3. Ali — visited yesterday @ North (closed)
        var aliYesterday = new AttendanceEntry
        {
            MemberId = ali.Id,
            MemberPackageId = aliVip.Id,
            BranchId = north,
            CheckInAtUtc = now.AddHours(-26),
            CheckOutAtUtc = now.AddHours(-24),
            CreatedAtUtc = now.AddHours(-26),
        };

        // ---------------------------------------------------------------- 4. Ali — visited 3 days ago @ South on Basic (closed)
        var aliBasicSouth = aliPackages.FirstOrDefault(mp =>
            string.Equals(mp.PackageKind, "Exercise", StringComparison.Ordinal) && mp.BranchId == south);
        var aliThreeDaysAgo = aliBasicSouth is null
            ? null
            : new AttendanceEntry
            {
                MemberId = ali.Id,
                MemberPackageId = aliBasicSouth.Id,
                BranchId = south,
                CheckInAtUtc = now.AddHours(-74),
                CheckOutAtUtc = now.AddHours(-72),
                CreatedAtUtc = now.AddHours(-74),
            };

        db.AttendanceEntries.AddRange(maryamEntry, saraEntry, aliYesterday);
        if (aliThreeDaysAgo is not null)
        {
            db.AttendanceEntries.Add(aliThreeDaysAgo);
        }

        await db.SaveChangesAsync();
    }
}
