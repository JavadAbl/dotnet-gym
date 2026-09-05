using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Coaching.Domain;

/// <summary>
/// One logged personal-training session: what the member actually performed under their
/// coach's supervision. Optionally linked to the training plan it followed (plain id —
/// in-module reference, no cross-module boundary involved). No commissions are computed
/// anywhere in this module (locked decision #8).
/// </summary>
public class TrainingRecord : Entity
{
    public Guid CoachId { get; set; }

    public Guid MemberId { get; set; }

    public Guid? TrainingPlanId { get; set; }

    public Guid BranchId { get; set; }

    public DateTime PerformedAtUtc { get; set; }

    /// <summary>What was trained today (e.g. "Leg day — 4×8 squat @ 80kg").</summary>
    public string Summary { get; set; } = default!;

    public int? DurationMinutes { get; set; }

    /// <summary>Free-form intensity marker: Low / Medium / High (kept as string for UI flexibility).</summary>
    public string? Intensity { get; set; }

    public string? Note { get; set; }
}
