namespace Gms.Modules.Attendance.Public;

/// <summary>Attendance entry snapshot shared across modules (Coaching, dashboards).</summary>
public record AttendanceEntryDto(
    Guid Id,
    Guid MemberId,
    Guid MemberPackageId,
    Guid BranchId,
    DateTime CheckInAtUtc,
    DateTime? CheckOutAtUtc);

/// <summary>
/// Attendance module contract. Other modules store attendance-entry ids but resolve
/// entry data exclusively through this interface (no FKs, no JOINs across module databases).
/// </summary>
public interface IAttendanceModule
{
    /// <summary>True while the member has an open (not checked-out) entry — i.e. currently present.</summary>
    Task<bool> IsMemberPresentAsync(Guid memberId, CancellationToken cancellationToken = default);

    /// <summary>Recent visits of a member, newest first.</summary>
    Task<IReadOnlyList<AttendanceEntryDto>> GetForMemberAsync(
        Guid memberId, int limit = 20, CancellationToken cancellationToken = default);
}
