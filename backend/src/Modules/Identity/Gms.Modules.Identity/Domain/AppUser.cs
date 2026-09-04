using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Identity.Domain;

/// <summary>
/// An internal operator (admin / reception / buffet / coach).
/// Role is stored as a string (one of <see cref="Gms.BuildingBlocks.UserRoles"/>).
/// <see cref="BranchId"/> is a cross-module id into the Branches module — no FK by design.
/// </summary>
public class AppUser : Entity
{
    public string Username { get; set; } = default!;

    public string PasswordHash { get; set; } = default!;

    public string DisplayName { get; set; } = default!;

    public string Role { get; set; } = default!;

    public Guid? BranchId { get; set; }

    public bool IsActive { get; set; } = true;
}
