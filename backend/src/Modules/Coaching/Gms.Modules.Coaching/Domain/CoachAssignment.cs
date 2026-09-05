using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Coaching.Domain;

/// <summary>
/// Links a coach (Identity user, role=coach) to a member they personally train at a branch.
/// CoachId / MemberId / BranchId are cross-module ids (no FKs by design) — resolved via the
/// Identity / Members / Branches public contracts. <c>ReleasedAtUtc == null</c> means the
/// assignment is active; a released assignment stays in history.
/// </summary>
public class CoachAssignment : Entity
{
    public Guid CoachId { get; set; }

    public Guid MemberId { get; set; }

    /// <summary>Branch where the personal training takes place (pinned from the operator's JWT claim or chosen by admin).</summary>
    public Guid BranchId { get; set; }

    public DateTime AssignedAtUtc { get; set; }

    /// <summary>Null while the coach actively trains this member.</summary>
    public DateTime? ReleasedAtUtc { get; set; }

    public string? Note { get; set; }
}
