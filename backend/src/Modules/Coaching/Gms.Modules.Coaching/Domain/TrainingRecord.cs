using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Coaching.Domain;

/// <summary>
/// One logged personal-training session: what the member actually performed under their
/// coach's supervision. Optionally linked to the training plan it followed (plain id —
/// in-module reference, no cross-module boundary involved). No commissions are computed
/// anywhere in this module (locked decision #8).
/// v2 — every logged session is paid for by the member's private coach package:
/// <see cref="MemberPackageId"/> stores the consumed Sales-module package (id only, no FK),
/// and the consumption itself happens atomically through the Sales public contract.
/// </summary>
public class TrainingRecord : Entity
{
    public Guid CoachId { get; set; }

    public Guid MemberId { get; set; }

    public Guid? TrainingPlanId { get; set; }

    /// <summary>v2 — the private-coach package instance that paid for this session (cross-module id, no FK).</summary>
    public Guid? MemberPackageId { get; set; }

    public Guid BranchId { get; set; }

    public DateTime PerformedAtUtc { get; set; }

    /// <summary>What was trained today (e.g. "Leg day — 4×8 squat @ 80kg").</summary>
    public string Summary { get; set; } = default!;

    public int? DurationMinutes { get; set; }

    /// <summary>Free-form intensity marker: Low / Medium / High (kept as string for UI flexibility).</summary>
    public string? Intensity { get; set; }

    public string? Note { get; set; }
}
