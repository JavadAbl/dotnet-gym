using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Sales.Domain;

/// <summary>
/// One freeze episode of a member package. Freeze is open-ended; on unfreeze the elapsed
/// whole days are recorded and the package expiry is shifted forward by exactly those days
/// (locked decision #6: frozen time never consumes validity).
/// </summary>
public class PackageFreeze : Entity
{
    public Guid MemberPackageId { get; set; }

    public DateTime FrozenAtUtc { get; set; }

    public DateTime? UnfrozenAtUtc { get; set; }

    /// <summary>Whole frozen days, set on unfreeze (ceiling of the elapsed span).</summary>
    public int? FrozenDays { get; set; }
}
