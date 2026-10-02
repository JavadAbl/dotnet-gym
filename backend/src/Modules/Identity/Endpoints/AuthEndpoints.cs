using System.Security.Claims;
using Gms.BuildingBlocks.Results;
using Gms.Modules.Identity.Application;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace Gms.Modules.Identity.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/auth").WithTags("Auth");

        group.MapPost("/login", async (LoginRequest request, AuthService authService, CancellationToken ct)
            => (await authService.LoginAsync(request, ct)).ToIResult());

        group.MapPost("/refresh", async (RefreshRequest request, AuthService authService, CancellationToken ct)
            => (await authService.RefreshAsync(request.RefreshToken, ct)).ToIResult());

        group.MapPost("/logout", async (LogoutRequest request, AuthService authService, CancellationToken ct)
            =>
        {
            await authService.LogoutAsync(request.RefreshToken, ct);
            return Results.Ok(new { ok = true });
        });

        return app;
    }

    public static IEndpointRouteBuilder MapMeEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/me", (ClaimsPrincipal user) =>
        {
            var id = user.FindFirstValue("sub");
            var roles = user.FindAll("role").Select(c => c.Value).ToList();
            var branchRaw = user.FindFirstValue("branchId");

            return Results.Ok(new MeResponse(
                Guid.Parse(id!),
                user.FindFirstValue("name") ?? string.Empty,
                roles,
                branchRaw is null ? null : Guid.Parse(branchRaw)));
        }).RequireAuthorization().WithTags("Auth");

        return app;
    }
}
