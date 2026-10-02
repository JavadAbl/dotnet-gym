using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Identity.Domain;

public sealed class User : BaseEntity
{
    public string? UserName { get; set; }
    public string? Phone { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = [];
    public bool IsActive { get; set; } = true;
}
