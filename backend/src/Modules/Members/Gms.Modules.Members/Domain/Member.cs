using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Members.Domain;

/// <summary>
/// A gym member. <see cref="HomeBranchId"/> is a cross-module id (no FK by design).
/// Purchased packages belong to the SALES module (Phase 3) — resolved via its public contract, never JOINed here.
/// </summary>
public class Member : Entity
{
    /// <summary>Sequential display code (M-00001, …) — friendly handle for reception.</summary>
    public string Code { get; set; } = default!;

    public string FullName { get; set; } = default!;

    public string? PhoneNumber { get; set; }

    public Gender Gender { get; set; } = Gender.Unknown;

    public DateTime? BirthDateUtc { get; set; }

    public DateTime JoinDateUtc { get; set; } = DateTime.UtcNow;

    public Guid HomeBranchId { get; set; }

    /// <summary>RFID / membership card code used by the attendance gate (Phase 4).</summary>
    public string? CardCode { get; set; }

    public MemberStatus Status { get; set; } = MemberStatus.Active;

    public string? Notes { get; set; }
}
