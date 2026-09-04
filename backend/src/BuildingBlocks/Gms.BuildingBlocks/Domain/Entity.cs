namespace Gms.BuildingBlocks.Domain;

/// <summary>
/// Base entity for all modules: GUID identity + audit timestamps (UTC).
/// Cross-module references are always stored as plain <see cref="Guid"/> ids — never navigation properties.
/// </summary>
public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}
