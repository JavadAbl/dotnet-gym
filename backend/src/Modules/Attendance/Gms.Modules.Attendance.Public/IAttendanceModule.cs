namespace Gms.Modules.Attendance.Public;

/// <summary>
/// Attendance module contract — implemented in Phase 4.
/// Card-swipe check-in with entry validation (member active, package Active, not frozen,
/// not expired, sessions remaining, branch allowed) and ATOMIC session consumption:
/// UPDATE ... WHERE SessionsUsed &lt; SessionsTotal (checked rows == 1 ⇒ success).
/// </summary>
public interface IAttendanceModule
{
}
