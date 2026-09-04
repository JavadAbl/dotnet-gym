using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Catalog.Domain;

/// <summary>
/// An exercise package defined GLOBALLY with a GLOBAL price (locked decision #4).
/// Availability per branch is granted via <see cref="PackageBranchAccess"/>.
/// Price is integer Toman (locked decision #2).
/// </summary>
public class ExercisePackage : Entity
{
    public string NameEn { get; set; } = default!;

    public string NameFa { get; set; } = default!;

    public int SessionsCount { get; set; }

    public int DurationDays { get; set; }

    public long PriceToman { get; set; }

    public bool IsActive { get; set; } = true;

    public List<PackageBranchAccess> BranchAccess { get; set; } = [];
}
