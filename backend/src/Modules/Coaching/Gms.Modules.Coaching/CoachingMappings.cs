using Gms.Modules.Coaching.Domain;

namespace Gms.Modules.Coaching;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS (locked engineering rule).</summary>
public static class CoachingMappings
{
    public static Public.CoachAssignmentDto ToPublicDto(this Domain.CoachAssignment assignment) =>
        new(
            assignment.Id,
            assignment.CoachId,
            assignment.MemberId,
            assignment.BranchId,
            assignment.AssignedAtUtc,
            assignment.ReleasedAtUtc);
}
