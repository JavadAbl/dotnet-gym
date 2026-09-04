using Gms.Modules.Attendance.Domain;

namespace Gms.Modules.Attendance;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS (locked engineering rule).</summary>
public static class AttendanceMappings
{
    public static Public.AttendanceEntryDto ToPublicDto(this Domain.AttendanceEntry entry) =>
        new(
            entry.Id,
            entry.MemberId,
            entry.MemberPackageId,
            entry.BranchId,
            entry.CheckInAtUtc,
            entry.CheckOutAtUtc);
}
