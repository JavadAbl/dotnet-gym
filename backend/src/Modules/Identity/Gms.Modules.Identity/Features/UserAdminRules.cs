using System.Text.RegularExpressions;

namespace Gms.Modules.Identity.Features;

/// <summary>
/// Pure rules for the user-admin endpoints (v2.1) — no EF, no HTTP, fully unit-testable
/// (same pattern as Sales.SalesMath). The endpoints are thin executors of these rules.
/// </summary>
public static partial class UserAdminRules
{
    public static readonly IReadOnlyList<string> AllowedRoles =
        [Gms.BuildingBlocks.UserRoles.Admin, Gms.BuildingBlocks.UserRoles.Reception, Gms.BuildingBlocks.UserRoles.Buffet, Gms.BuildingBlocks.UserRoles.Coach];

    public const int UsernameMinLength = 3;
    public const int UsernameMaxLength = 64;
    public const int PasswordMinLength = 8;
    public const int PasswordMaxLength = 128;
    public const int DisplayNameMaxLength = 128;

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$")]
    private static partial Regex UsernamePattern();

    public static string NormalizeUsername(string username) => username.Trim().ToLowerInvariant();

    public static bool IsValidUsername(string username) =>
        username.Length >= UsernameMinLength
        && username.Length <= UsernameMaxLength
        && UsernamePattern().IsMatch(username);

    public static bool IsValidPassword(string password) =>
        password.Length >= PasswordMinLength && password.Length <= PasswordMaxLength;

    public static bool IsValidRole(string role) => AllowedRoles.Contains(role);

    /// <summary>
    /// Deactivation guard: an admin cannot deactivate themselves (lockout) and cannot
    /// deactivate the LAST active admin (system lockout). Returns an ErrorCodes identity
    /// value when the operation must be rejected, null when allowed.
    /// </summary>
    public static string? CheckDeactivate(Guid currentUserId, Gms.Modules.Identity.Domain.AppUser target, IReadOnlyList<Gms.Modules.Identity.Domain.AppUser> allUsers)
    {
        if (target.Id == currentUserId)
        {
            return Gms.BuildingBlocks.ErrorCodes.IdentityUserSelfDeactivate;
        }

        var targetIsAdmin = string.Equals(target.Role, Gms.BuildingBlocks.UserRoles.Admin, StringComparison.OrdinalIgnoreCase);
        if (!targetIsAdmin || !target.IsActive)
        {
            return null;
        }

        var activeAdmins = allUsers.Count(u =>
            u.IsActive
            && string.Equals(u.Role, Gms.BuildingBlocks.UserRoles.Admin, StringComparison.OrdinalIgnoreCase));
        return activeAdmins <= 1 ? Gms.BuildingBlocks.ErrorCodes.IdentityUserLastAdmin : null;
    }
}
