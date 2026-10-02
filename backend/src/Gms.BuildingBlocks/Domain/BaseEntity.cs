namespace Gms.BuildingBlocks.Domain;

public abstract class BaseEntity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
    public DateTime CreatedAtUtc { get; protected set; } = DateTime.UtcNow;
    public DateTime? UpdatedAtUtc { get; protected set; }

    /// <summary>Optimistic-concurrency token (SQLite has no rowversion; a Guid per change works).</summary>
    public Guid Version { get; protected set; } = Guid.NewGuid();

    public void Touch()
    {
        UpdatedAtUtc = DateTime.UtcNow;
        Version = Guid.NewGuid();
    }
}
