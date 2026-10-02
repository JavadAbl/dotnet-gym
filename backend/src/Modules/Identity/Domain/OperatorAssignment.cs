using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Identity.Domain;

/// <summary>Links an operator user to the branch they work at (single branch in v1).</summary>
public sealed class OperatorAssignment : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid BranchId { get; set; }
}
