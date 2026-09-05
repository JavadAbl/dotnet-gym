using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Catalog.Domain;

/// <summary>
/// Package families sold by the chain (v2). Exercise packages gate gym entry (Attendance);
/// PrivateCoaching packages gate personal-training service (Coaching) — a coach may only
/// serve members holding an active private package with sessions remaining.
/// </summary>
public enum PackageKind
{
    Exercise = 0,
    PrivateCoaching = 1,
}

/// <summary>
/// A package defined GLOBALLY with a GLOBAL price (locked decision #4).
/// Availability per branch is granted via <see cref="PackageBranchAccess"/>.
/// Price is integer Toman (locked decision #2).
/// </summary>
public class ExercisePackage : Entity
{
    public string NameEn { get; set; } = default!;

    public string NameFa { get; set; } = default!;

    /// <summary>Package family (v2): Exercise | PrivateCoaching. Snapshot is copied onto every purchase.</summary>
    public PackageKind Kind { get; set; } = PackageKind.Exercise;

    public int SessionsCount { get; set; }

    public int DurationDays { get; set; }

    public long PriceToman { get; set; }

    public bool IsActive { get; set; } = true;

    public List<PackageBranchAccess> BranchAccess { get; set; } = [];
}
