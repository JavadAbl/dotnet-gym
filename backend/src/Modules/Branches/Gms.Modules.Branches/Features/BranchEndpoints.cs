using Gms.BuildingBlocks;
using Gms.Modules.Branches.Domain;
using Gms.Modules.Branches.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Branches.Features;

/// <summary>Branch management endpoints (list for staff, create/update for admin).</summary>
public static class BranchEndpoints
{
    public sealed record CreateBranchRequest(string NameEn, string NameFa, string? City, string? PhoneNumber, bool IsActive = true);

    public sealed record UpdateBranchRequest(string NameEn, string NameFa, string? City, string? PhoneNumber, bool IsActive);

    public static void Map(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/branches").WithTags("Branches");

        group.MapGet("/", async (BranchesDbContext db, CancellationToken cancellationToken) =>
            {
                var branches = await db.Branches.AsNoTracking()
                    .OrderBy(b => b.CreatedAtUtc)
                    .ToListAsync(cancellationToken);
                return Results.Ok(branches.Select(b => b.ToDto()).ToList());
            })
            .RequireAuthorization(Policies.Staff)
            .WithSummary("All branches (staff).");

        group.MapGet("/{id:guid}", async (Guid id, BranchesDbContext db, CancellationToken cancellationToken) =>
            {
                var branch = await db.Branches.AsNoTracking().FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
                return branch is null
                    ? throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404)
                    : Results.Ok(branch.ToDto());
            })
            .RequireAuthorization(Policies.Staff)
            .WithSummary("Branch by id.");

        group.MapPost("/", async (CreateBranchRequest request, BranchesDbContext db, CancellationToken cancellationToken) =>
            {
                Validate(request.NameEn, request.NameFa);

                var branch = new Branch
                {
                    NameEn = request.NameEn.Trim(),
                    NameFa = request.NameFa.Trim(),
                    City = request.City?.Trim(),
                    PhoneNumber = request.PhoneNumber?.Trim(),
                    IsActive = request.IsActive,
                };
                db.Branches.Add(branch);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/branches/{branch.Id}", branch.ToDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Create a branch (admin).");

        group.MapPut("/{id:guid}", async (Guid id, UpdateBranchRequest request, BranchesDbContext db, CancellationToken cancellationToken) =>
            {
                Validate(request.NameEn, request.NameFa);

                var branch = await db.Branches.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
                if (branch is null)
                {
                    throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                }

                branch.NameEn = request.NameEn.Trim();
                branch.NameFa = request.NameFa.Trim();
                branch.City = request.City?.Trim();
                branch.PhoneNumber = request.PhoneNumber?.Trim();
                branch.IsActive = request.IsActive;
                branch.UpdatedAtUtc = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(branch.ToDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Update a branch (admin).");
    }

    private static void Validate(string nameEn, string nameFa)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(nameEn) || nameEn.Trim().Length > 128)
        {
            errors["nameEn"] = ["Required, max 128 characters."];
        }
        if (string.IsNullOrWhiteSpace(nameFa) || nameFa.Trim().Length > 128)
        {
            errors["nameFa"] = ["Required, max 128 characters."];
        }
        if (errors.Count > 0)
        {
            throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
        }
    }
}
