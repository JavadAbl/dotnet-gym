using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Features;
using Xunit;

namespace Gms.Core.Tests;

/// <summary>
/// v2.1 — pins the pure user-admin rules: username/password/role validation and the
/// deactivation guards (self lockout, last-active-admin lockout).
/// </summary>
public class UserAdminRulesTests
{
    private static AppUser User(string username, string role = "reception", bool isActive = true, Guid? id = null) =>
        new()
        {
            Id = id ?? Guid.NewGuid(),
            Username = username,
            PasswordHash = "x",
            DisplayName = username,
            Role = role,
            IsActive = isActive,
        };

    // ---------------------------------------------------------------- username

    [Theory]
    [InlineData("reception.north")]
    [InlineData("buffet_south")]
    [InlineData("a1")]
    [InlineData("ab-cd_ef.gh")]
    public void Username_valid_shapes_pass(string username)
    {
        Assert.True(UserAdminRules.IsValidUsername(username));
    }

    [Theory]
    [InlineData("ab")]          // too short
    [InlineData("Aupper")]      // uppercase not allowed
    [InlineData(".leading")]    // must start alnum
    [InlineData("trailing-")]   // must end alnum
    [InlineData("sp ace")]      // whitespace rejected
    public void Username_invalid_shapes_rejected(string username)
    {
        Assert.False(UserAdminRules.IsValidUsername(username));
    }

    [Fact]
    public void Username_normalization_trims_and_lowers()
    {
        Assert.Equal("admin", UserAdminRules.NormalizeUsername("  ADMIN  "));
    }

    // ---------------------------------------------------------------- password / role

    [Theory]
    [InlineData("Admin@123")]
    [InlineData("12345678")]
    public void Password_meets_minimum_passes(string password)
    {
        Assert.True(UserAdminRules.IsValidPassword(password));
    }

    [Theory]
    [InlineData("A@12345")]     // 7 chars — too short
    [InlineData("")]
    public void Password_below_minimum_rejected(string password)
    {
        Assert.False(UserAdminRules.IsValidPassword(password));
    }

    [Fact]
    public void Role_whitelist_is_exactly_the_four_operator_roles()
    {
        Assert.True(UserAdminRules.IsValidRole("admin"));
        Assert.True(UserAdminRules.IsValidRole("coach"));
        Assert.False(UserAdminRules.IsValidRole("owner"));
        Assert.False(UserAdminRules.IsValidRole(""));
        Assert.Equal(4, UserAdminRules.AllowedRoles.Count);
    }

    // ---------------------------------------------------------------- deactivation guards

    [Fact]
    public void Deactivate_self_rejected_even_for_admins()
    {
        var self = User("admin", role: "admin", id: Guid.NewGuid());
        var rejection = UserAdminRules.CheckDeactivate(self.Id, self, [self]);
        Assert.Equal("identity.user.self_deactivate", rejection);
    }

    [Fact]
    public void Deactivate_last_active_admin_rejected()
    {
        var acting = User("admin1", role: "admin");
        var target = User("admin2", role: "admin");
        // Acting admin is INACTIVE: target is the only ACTIVE admin → protected.
        acting = User("admin1", role: "admin", isActive: false, id: acting.Id);

        var rejection = UserAdminRules.CheckDeactivate(acting.Id, target, [acting, target]);
        Assert.Equal("identity.user.last_admin", rejection);
    }

    [Fact]
    public void Deactivate_admin_with_another_active_admin_allowed()
    {
        var acting = User("admin1", role: "admin");
        var target = User("admin2", role: "admin");
        var other = User("admin3", role: "admin");

        var rejection = UserAdminRules.CheckDeactivate(acting.Id, target, [acting, target, other]);
        Assert.Null(rejection);
    }

    [Fact]
    public void Deactivate_inactive_admin_is_unrestricted()
    {
        var acting = User("admin1", role: "admin");
        var target = User("admin2", role: "admin", isActive: false);

        // Only one ACTIVE admin exists, but the target is already inactive → allowed (idempotent).
        var rejection = UserAdminRules.CheckDeactivate(acting.Id, target, [acting, target]);
        Assert.Null(rejection);
    }

    [Fact]
    public void Deactivate_plain_operator_never_locked_by_admin_shortage()
    {
        var acting = User("admin", role: "admin");
        var target = User("reception.south", role: "reception");

        var rejection = UserAdminRules.CheckDeactivate(acting.Id, target, [acting, target]);
        Assert.Null(rejection);
    }
}
