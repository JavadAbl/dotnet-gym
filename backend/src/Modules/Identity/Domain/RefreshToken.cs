using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Identity.Domain;

public sealed class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
    public string? ReplacedByTokenHash { get; set; }

    public bool IsUsable(DateTime nowUtc) => RevokedAtUtc is null && ExpiresAtUtc > nowUtc;
}
