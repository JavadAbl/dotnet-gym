namespace Gms.Modules.Identity.Application;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "gms.api";
    public string Audience { get; set; } = "gms.clients";
    public string Key { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 120;
    public int RefreshTokenDays { get; set; } = 7;
}
