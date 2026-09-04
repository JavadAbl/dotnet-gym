using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Gms.Modules.Identity.Domain;
using Microsoft.IdentityModel.Tokens;

namespace Gms.Modules.Identity.Infrastructure;

/// <summary>Issues JWTs carrying sub / unique_name / role / branchId claims.</summary>
public sealed class TokenService(IConfiguration configuration)
{
    public (string Token, int ExpiresInMinutes) CreateToken(AppUser user)
    {
        var jwt = configuration.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.")));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiresMinutes = int.TryParse(jwt["ExpiresMinutes"], out var m) ? m : 480;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(ClaimTypes.Role, user.Role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        if (user.BranchId is { } branchId)
        {
            claims.Add(new Claim("branchId", branchId.ToString()));
        }

        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(expiresMinutes),
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiresMinutes);
    }
}
