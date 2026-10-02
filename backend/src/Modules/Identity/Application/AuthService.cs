using Gms.BuildingBlocks.Results;
using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Gms.Modules.Identity.Application;

public sealed class AuthService(
    IdentityDbContext db,
    PasswordHasher<User> passwordHasher,
    TokenService tokenService,
    IOptions<JwtOptions> jwtOptions)
{
    private readonly int _refreshTokenDays = jwtOptions.Value.RefreshTokenDays;

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var login = request.UserName.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.UserName == login || u.Phone == login, ct);
        if (user is null || !user.IsActive)
            return Result<AuthResponse>.Fail(401, "AUTH_INVALID_CREDENTIALS", "User name or password is incorrect.");

        var verification = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
            return Result<AuthResponse>.Fail(401, "AUTH_INVALID_CREDENTIALS", "User name or password is incorrect.");

        var branchId = await db.OperatorAssignments
            .Where(a => a.UserId == user.Id)
            .Select(a => (Guid?)a.BranchId)
            .FirstOrDefaultAsync(ct);

        return Result<AuthResponse>.Ok(await IssueTokensAsync(user, branchId, ct));
    }

    public async Task<Result<AuthResponse>> RefreshAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null || !stored.IsUsable(DateTime.UtcNow))
            return Result<AuthResponse>.Fail(401, "AUTH_INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired.");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == stored.UserId, ct);
        if (user is null || !user.IsActive)
            return Result<AuthResponse>.Fail(401, "AUTH_INVALID_REFRESH_TOKEN", "User is inactive.");

        var branchId = await db.OperatorAssignments
            .Where(a => a.UserId == user.Id)
            .Select(a => (Guid?)a.BranchId)
            .FirstOrDefaultAsync(ct);

        var response = await IssueTokensAsync(user, branchId, ct);

        // Rotate: single-use refresh tokens.
        stored.RevokedAtUtc = DateTime.UtcNow;
        stored.ReplacedByTokenHash = TokenService.Hash(response.RefreshToken);
        await db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Ok(response);
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct = default)
    {
        var hash = TokenService.Hash(refreshToken);
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is { RevokedAtUtc: null })
        {
            stored.RevokedAtUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, Guid? branchId, CancellationToken ct)
    {
        var (accessToken, expiresAt) = tokenService.CreateAccessToken(user, branchId);
        var refreshToken = TokenService.GenerateRefreshToken();

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = TokenService.Hash(refreshToken),
            ExpiresAtUtc = DateTime.UtcNow.AddDays(_refreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new AuthResponse(user.ToDto(), accessToken, expiresAt, refreshToken);
    }
}
