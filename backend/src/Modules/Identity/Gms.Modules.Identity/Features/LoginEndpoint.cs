using Gms.BuildingBlocks;
using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity.Features;

/// <summary>POST /api/v1/identity/login — issues a JWT for internal operators.</summary>
public static class LoginEndpoint
{
    public sealed record LoginRequest(string Username, string Password);

    public sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, AuthUserDto User);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/identity/login", async (
                LoginRequest request,
                IdentityDbContext db,
                TokenService tokenService,
                CancellationToken cancellationToken) =>
            {
                var username = request.Username.Trim().ToLowerInvariant();

                var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username, cancellationToken);
                if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
                {
                    throw new GmsException(
                        ErrorCodes.IdentityInvalidCredentials,
                        "Invalid username or password.",
                        statusCode: 401);
                }

                if (!user.IsActive)
                {
                    throw new GmsException(
                        ErrorCodes.IdentityUserInactive,
                        "This account has been deactivated.",
                        statusCode: 403);
                }

                var (token, expiresMinutes) = tokenService.CreateToken(user);
                return Results.Ok(new LoginResponse(token, expiresMinutes * 60, user.ToDto()));
            })
            .AllowAnonymous()
            .WithTags("Identity")
            .WithSummary("Login with username and password, receive a JWT.");
    }
}
