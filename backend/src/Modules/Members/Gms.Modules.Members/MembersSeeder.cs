using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Domain;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members;

/// <summary>Phase 2 seeds: a few demo members so the UI is not empty on first run.</summary>
public static class MembersSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Infrastructure.MembersDbContext>();

        await db.Database.EnsureCreatedAsync();

        if (await db.Members.AnyAsync())
        {
            return;
        }

        // Resolve home-branch ids through the Branches public contract (module rule #1).
        var branchesApi = scope.ServiceProvider.GetRequiredService<IBranchesModule>();
        var branches = await branchesApi.GetAllAsync();
        if (branches.Count == 0)
        {
            return; // branches must be seeded first (see Program.cs boot order)
        }

        var north = branches.First(b => b.NameEn == "North Branch").Id;
        var south = branches.First(b => b.NameEn == "South Branch").Id;

        Member Demo(string fullName, string phone, Gender gender, Guid branch, string card, int n) => new()
        {
            Code = $"M-{n:D5}",
            FullName = fullName,
            PhoneNumber = phone,
            Gender = gender,
            HomeBranchId = branch,
            CardCode = card,
            Status = MemberStatus.Active,
        };

        db.Members.AddRange(
            Demo("علی محمدی", "09121110001", Gender.Male, north, "RF-0001", 1),
            Demo("سارا کریمی", "09121110002", Gender.Female, south, "RF-0002", 2),
            Demo("رضا حسینی", "09121110003", Gender.Male, south, "RF-0003", 3),
            Demo("مریم احمدی", "09121110004", Gender.Female, north, "RF-0004", 4));

        await db.SaveChangesAsync();
    }
}
