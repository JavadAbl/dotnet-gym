using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Domain;
using Gms.Modules.Catalog.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Catalog.Features;

/// <summary>Catalog read endpoints + admin package creation (validates branches via the public contract).</summary>
public static class CatalogEndpoints
{
    public sealed record CreatePackageRequest(
        string NameEn,
        string NameFa,
        int SessionsCount,
        int DurationDays,
        long PriceToman,
        IReadOnlyList<Guid> BranchIds,
        bool IsActive = true,
        string Kind = Public.PackageKindNames.Exercise);

    public static void Map(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/catalog").WithTags("Catalog");

        group.MapGet("/packages", async (CatalogDbContext db, string? kind, CancellationToken cancellationToken) =>
            {
                var query = db.Packages.AsNoTracking().Include(p => p.BranchAccess).AsQueryable();
                if (!string.IsNullOrWhiteSpace(kind))
                {
                    var kindFilter = ParseKind(kind);
                    if (kindFilter is null)
                    {
                        throw new GmsException(
                            ErrorCodes.ValidationFailed,
                            "Package kind must be Exercise or PrivateCoaching.",
                            400,
                            new Dictionary<string, string[]> { ["kind"] = ["Exercise or PrivateCoaching are the only accepted values."] });
                    }

                    query = query.Where(p => p.Kind == kindFilter);
                }

                var packages = await query
                    .OrderBy(p => p.CreatedAtUtc)
                    .ToListAsync(cancellationToken);
                return Results.Ok(packages.Select(p => p.ToDto()).ToList());
            })
            .RequireAuthorization(Policies.Staff)
            .WithSummary("All packages (global definitions + granted branches), optionally filtered by kind.");

        group.MapGet("/packages/{id:guid}", async (Guid id, CatalogDbContext db, CancellationToken cancellationToken) =>
            {
                var package = await db.Packages.AsNoTracking()
                    .Include(p => p.BranchAccess)
                    .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
                return package is null
                    ? throw new GmsException(ErrorCodes.PackageNotFound, "Package not found.", 404)
                    : Results.Ok(package.ToDto());
            })
            .RequireAuthorization(Policies.Staff)
            .WithSummary("Package by id (either kind).");

        group.MapPost("/packages", async (
                CreatePackageRequest request,
                CatalogDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var errors = Validate(request);

                // Cross-module validation through the Branches public contract (never join across modules).
                foreach (var branchId in request.BranchIds.Distinct())
                {
                    if (!await branches.ExistsAsync(branchId, cancellationToken))
                    {
                        errors[$"branchIds[{branchId}]"] = ["Unknown or inactive branch."];
                    }
                }

                if (errors.Count > 0)
                {
                    throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                }

                var package = new ExercisePackage
                {
                    NameEn = request.NameEn.Trim(),
                    NameFa = request.NameFa.Trim(),
                    Kind = ParseKind(request.Kind)
                        ?? throw new GmsException(
                            ErrorCodes.ValidationFailed,
                            "One or more validation errors occurred.",
                            400,
                            new Dictionary<string, string[]> { ["kind"] = ["Exercise or PrivateCoaching are the only accepted values."] }),
                    SessionsCount = request.SessionsCount,
                    DurationDays = request.DurationDays,
                    PriceToman = request.PriceToman,
                    IsActive = request.IsActive,
                    BranchAccess = request.BranchIds.Distinct()
                        .Select(branchId => new PackageBranchAccess { BranchId = branchId })
                        .ToList(),
                };

                db.Packages.Add(package);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/catalog/packages/{package.Id}", package.ToDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Create a package (admin) — Exercise or PrivateCoaching.");

        group.MapGet("/products", async (Guid? branchId, CatalogDbContext db, CancellationToken cancellationToken) =>
            {
                var query = db.BuffetProducts.AsNoTracking().Include(p => p.Prices).AsQueryable();
                if (branchId is { } branch)
                {
                    query = query.Where(p => p.Prices.Any(pr => pr.BranchId == branch));
                }

                var products = await query.OrderBy(p => p.CreatedAtUtc).ToListAsync(cancellationToken);
                return Results.Ok(products.Select(p => p.ToDto()).ToList());
            })
            .RequireAuthorization(Policies.Staff)
            .WithSummary("Buffet products with per-branch prices (optional branchId filter).");
    }

    private static Domain.PackageKind? ParseKind(string? value) => value?.Trim() switch
    {
        "Exercise" => Domain.PackageKind.Exercise,
        "PrivateCoaching" => Domain.PackageKind.PrivateCoaching,
        _ => null,
    };

    private static Dictionary<string, string[]> Validate(CreatePackageRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.NameEn) || request.NameEn.Trim().Length > 128)
        {
            errors["nameEn"] = ["Required, max 128 characters."];
        }
        if (string.IsNullOrWhiteSpace(request.NameFa) || request.NameFa.Trim().Length > 128)
        {
            errors["nameFa"] = ["Required, max 128 characters."];
        }
        if (request.SessionsCount is < 1 or > 1000)
        {
            errors["sessionsCount"] = ["Must be between 1 and 1000."];
        }
        if (request.DurationDays is < 1 or > 3650)
        {
            errors["durationDays"] = ["Must be between 1 and 3650."];
        }
        if (request.PriceToman <= 0)
        {
            errors["priceToman"] = ["Must be a positive integer amount of Toman."];
        }
        if (request.BranchIds.Count == 0)
        {
            errors["branchIds"] = ["At least one branch must be granted."];
        }
        return errors;
    }
}
