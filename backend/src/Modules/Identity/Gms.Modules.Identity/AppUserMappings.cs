using Gms.Modules.Identity.Domain;

namespace Gms.Modules.Identity;

/// <summary>Hand-written mapping extensions — AutoMapper is intentionally not used in GMS.</summary>
public static class AppUserMappings
{
    public static AuthUserDto ToDto(this AppUser user) =>
        new(user.Id, user.Username, user.DisplayName, user.Role, user.BranchId);
}
