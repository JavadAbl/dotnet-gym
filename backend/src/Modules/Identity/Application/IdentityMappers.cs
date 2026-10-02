using Gms.Modules.Identity.Domain;

namespace Gms.Modules.Identity.Application;

/// <summary>Manual mapping extensions — AutoMapper is banned in this codebase (project rule).</summary>
public static class IdentityMappers
{
    public static UserDto ToDto(this User user) => new(user.Id, user.UserName, user.FullName, user.Phone, user.Roles);
}
