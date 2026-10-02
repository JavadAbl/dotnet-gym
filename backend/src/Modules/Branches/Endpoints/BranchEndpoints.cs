using Gms.Modules.Branches.Application;
using Gms.Modules.Branches.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches.Endpoints;

public static class BranchEndpoints
{
    public static IEndpointRouteBuilder MapBranchEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/branches").WithTags("Branches").RequireAuthorization();

        group.MapGet("/", async (BranchesDbContext db, CancellationToken ct) =>
        {
            var branches = await db.Branches
                .AsNoTracking()
                .OrderBy(b => b.Name)
                .ToListAsync(ct);

            return Results.Ok(branches.Select(b => b.ToDto()));
        });

        return app;
    }
}
