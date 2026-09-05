using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Attendance.Domain;

/// <summary>
/// One gym visit: a member checked in at a branch on a specific member package.
/// MemberId / MemberPackageId / BranchId are cross-module ids (no FKs by design) —
/// resolved via the Members / Sales / Branches public contracts.
/// An entry with <c>CheckOutAtUtc == null</c> means the member is currently present.
/// </summary>
public class AttendanceEntry : Entity
{
    public Guid MemberId { get; set; }

    /// <summary>The member package whose session was consumed at check-in (atomic, via ISalesModule).</summary>
    public Guid MemberPackageId { get; set; }

    public Guid BranchId { get; set; }

    public DateTime CheckInAtUtc { get; set; }

    /// <summary>Null while the member is still inside (live presence board).</summary>
    public DateTime? CheckOutAtUtc { get; set; }
}
