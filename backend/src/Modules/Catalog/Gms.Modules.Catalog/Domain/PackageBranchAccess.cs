namespace Gms.Modules.Catalog.Domain;

/// <summary>Grants a globally-defined package to a branch. (PackageId, BranchId) unique — branch id is cross-module.</summary>
public class PackageBranchAccess
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PackageId { get; set; }

    public Guid BranchId { get; set; }
}
