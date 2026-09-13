using Gms.Modules.Identity.Domain;

namespace Gms.Modules.Identity;

/// <summary>Hand-written mapping extensions — AutoMapper is intentionally not used in GMS.</summary>
public static class AppUserMappings
{
    public static AuthUserDto ToDto(this AppUser user) =>
        new(user.Id, user.Username, user.DisplayName, user.Role, user.BranchId);

    /// <summary>v2.1 — admin-facing projection incl. the active flag (never exposed to other modules).</summary>
    public static Features.UserAdminEndpoints.UserAdminDto ToAdminDto(this AppUser user) =>
        new(user.Id, user.Username, user.DisplayName, user.Role, user.BranchId, user.IsActive, user.CreatedAtUtc);
}
