using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Coaching.Domain;

/// <summary>
/// A training plan a coach writes for one of their assigned members (session split,
/// exercises, progression notes). Plan content is free text — v1 keeps it simple and
/// locale-neutral. Creating a new active plan for the same coach-member pair archives
/// the previous one (history preserved, exactly one active plan per pair).
/// </summary>
public class TrainingPlan : Entity
{
    public Guid CoachId { get; set; }

    public Guid MemberId { get; set; }

    public string Title { get; set; } = default!;

    public string? Goal { get; set; }

    /// <summary>Plan body: weekly split, exercises, sets/reps, progression rules.</summary>
    public string Content { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public DateTime? ArchivedAtUtc { get; set; }
}
