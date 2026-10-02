using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Branches.Domain;

public sealed class Branch : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
}
