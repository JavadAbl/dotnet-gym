namespace Gms.Modules.Coaching.Public;

/// <summary>Coach-assignment snapshot shared across modules (dashboards, member 360 view).</summary>
public record CoachAssignmentDto(
    Guid Id,
    Guid CoachId,
    Guid MemberId,
    Guid BranchId,
    DateTime AssignedAtUtc,
    DateTime? ReleasedAtUtc);

/// <summary>
/// Coaching module contract. Other modules store coach/member ids but resolve assignment
/// data exclusively through this interface (no FKs, no JOINs across module databases).
/// Commissions are intentionally out of scope (locked decision #8).
/// </summary>
public interface ICoachingModule
{
    /// <summary>Active (not released) coach assignments of a member, newest first.</summary>
    Task<IReadOnlyList<CoachAssignmentDto>> GetActiveForMemberAsync(
        Guid memberId, CancellationToken cancellationToken = default);
}
