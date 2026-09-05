using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Branches.Domain;

/// <summary>A physical gym branch. Bilingual names: fa is primary for the UI, en for ops.</summary>
public class Branch : Entity
{
    public string NameEn { get; set; } = default!;

    public string NameFa { get; set; } = default!;

    public string? City { get; set; }

    public string? PhoneNumber { get; set; }

    public bool IsActive { get; set; } = true;
}
