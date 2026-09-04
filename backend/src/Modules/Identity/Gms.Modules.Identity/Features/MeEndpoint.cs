using Gms.BuildingBlocks;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity.Features;

/// <summary>GET /api/v1/identity/me — current operator profile (from JWT claims).</summary>
public static class MeEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/identity/me", async (
                ClaimsPrincipal principal,
                IdentityDbContext db,
                CancellationToken cancellationToken) =>
            {
                // JwtBearer maps "sub" → ClaimTypes.NameIdentifier by default; accept the raw claim too.
                var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? principal.FindFirstValue("sub");

                if (!Guid.TryParse(userIdClaim, out var userId))
                {
                    throw new GmsException(ErrorCodes.IdentityInvalidCredentials, "Invalid token subject.", 401);
                }

                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
                if (user is null)
                {
                    throw new GmsException(ErrorCodes.IdentityInvalidCredentials, "User no longer exists.", 401);
                }

                return Results.Ok(user.ToDto());
            })
            .RequireAuthorization(Policies.Staff)
            .WithTags("Identity")
            .WithSummary("Current operator profile.");
    }
}
