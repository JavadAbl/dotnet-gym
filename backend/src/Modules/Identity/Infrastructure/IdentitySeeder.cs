using Gms.Modules.Identity.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity.Infrastructure;

/// <summary>Dev-only seed users. Passwords must be rotated before any real deployment.</summary>
public static class IdentitySeeder
{
    public const string AdminUserName = "admin";
    public const string AdminPassword = "Admin@123";

    public static async Task SeedAsync(IdentityDbContext db, PasswordHasher<User> passwordHasher)
    {
        if (await db.Users.AnyAsync())
        {
            return;
        }

        AddUser(db, passwordHasher, AdminUserName, "System Administrator", AdminPassword, "Admin");
        AddUser(db, passwordHasher, "reception1", "Demo Receptionist", "Reception@123", "Reception");
        AddUser(db, passwordHasher, "buffet1", "Demo Buffet Operator", "Buffet@123", "Buffet");
        AddUser(db, passwordHasher, "coach1", "Demo Coach", "Coach@123", "Coach");

        await db.SaveChangesAsync();
    }

    private static void AddUser(
        IdentityDbContext db,
        PasswordHasher<User> hasher,
        string userName,
        string fullName,
        string password,
        string role)
    {
        var user = new User { UserName = userName, FullName = fullName, Roles = [role] };
        user.PasswordHash = hasher.HashPassword(user, password);
        db.Users.Add(user);
    }
}
