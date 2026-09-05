using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Domain;
using Gms.Modules.Catalog.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Catalog.Features;

/// <summary>
/// Phase 7 — buffet product &amp; per-branch price admin (locked decision #4: buffet prices are
/// the ONLY per-branch pricing in GMS). Branch existence is validated through the Branches
/// public contract — never a cross-module join. No inventory tracking (locked decision #7).
/// </summary>
public static class ProductEndpoints
{
    public sealed record ProductPriceRequest(Guid BranchId, long PriceToman);

    public sealed record CreateProductRequest(
        string NameEn,
        string NameFa,
        IReadOnlyList<ProductPriceRequest> Prices,
        bool IsActive = true);

    public sealed record UpdateProductRequest(
        string NameEn,
        string NameFa,
        bool IsActive,
        IReadOnlyList<ProductPriceRequest> Prices);

    public static void Map(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/catalog").WithTags("Catalog");

        group.MapPost("/products", async (
                CreateProductRequest request,
                CatalogDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var errors = ValidateNames(request.NameEn, request.NameFa);

                if (request.Prices.Count == 0)
                {
                    errors["prices"] = ["At least one branch price is required."];
                }

                foreach (var group2 in request.Prices.GroupBy(p => p.BranchId).Where(g => g.Count() > 1))
                {
                    errors[$"prices[{group2.Key}]"] = ["Duplicate branch price."];
                }

                foreach (var price in request.Prices)
                {
                    if (price.PriceToman <= 0)
                    {
                        errors[$"prices[{price.BranchId}]"] = ["Price must be a positive integer amount of Toman."];
                    }
                    else if (!await branches.ExistsAsync(price.BranchId, cancellationToken))
                    {
                        errors[$"prices[{price.BranchId}]"] = ["Unknown or inactive branch."];
                    }
                }

                if (await db.BuffetProducts.AnyAsync(
                        p => p.NameEn.ToLower() == request.NameEn.Trim().ToLower()
                            || p.NameFa.ToLower() == request.NameFa.Trim().ToLower(),
                        cancellationToken))
                {
                    errors["nameEn"] = ["A buffet product with this name already exists."];
                }

                if (errors.Count > 0)
                {
                    throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                }

                var product = new BuffetProduct
                {
                    NameEn = request.NameEn.Trim(),
                    NameFa = request.NameFa.Trim(),
                    IsActive = request.IsActive,
                    Prices = request.Prices
                        .Select(p => new BuffetProductPrice { BranchId = p.BranchId, PriceToman = p.PriceToman })
                        .ToList(),
                };

                db.BuffetProducts.Add(product);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/catalog/products/{product.Id}", product.ToDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Create a buffet product with per-branch prices (admin).");

        group.MapPut("/products/{id:guid}", async (
                Guid id,
                UpdateProductRequest request,
                CatalogDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var product = await db.BuffetProducts
                    .Include(p => p.Prices)
                    .FirstOrDefaultAsync(p => p.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.ProductNotFound, "Buffet product not found.", 404);

                var errors = ValidateNames(request.NameEn, request.NameFa);

                if (request.Prices.Count == 0)
                {
                    errors["prices"] = ["At least one branch price is required."];
                }

                foreach (var duplicate in request.Prices.GroupBy(p => p.BranchId).Where(g => g.Count() > 1))
                {
                    errors[$"prices[{duplicate.Key}]"] = ["Duplicate branch price."];
                }

                foreach (var price in request.Prices)
                {
                    if (price.PriceToman <= 0)
                    {
                        errors[$"prices[{price.BranchId}]"] = ["Price must be a positive integer amount of Toman."];
                    }
                    else if (!await branches.ExistsAsync(price.BranchId, cancellationToken))
                    {
                        errors[$"prices[{price.BranchId}]"] = ["Unknown or inactive branch."];
                    }
                }

                if (await db.BuffetProducts.AnyAsync(
                        p => p.Id != id
                            && (p.NameEn.ToLower() == request.NameEn.Trim().ToLower()
                                || p.NameFa.ToLower() == request.NameFa.Trim().ToLower()),
                        cancellationToken))
                {
                    errors["nameEn"] = ["A buffet product with this name already exists."];
                }

                if (errors.Count > 0)
                {
                    throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                }

                product.NameEn = request.NameEn.Trim();
                product.NameFa = request.NameFa.Trim();
                product.IsActive = request.IsActive;

                // Wholesale price replacement: upsert rows whose branch is present, drop the rest.
                // Past orders keep their own price snapshots (BuffetOrderItem.UnitPriceToman).
                foreach (var price in request.Prices)
                {
                    var existing = product.Prices.FirstOrDefault(p => p.BranchId == price.BranchId);
                    if (existing is null)
                    {
                        product.Prices.Add(new BuffetProductPrice { BranchId = price.BranchId, PriceToman = price.PriceToman });
                    }
                    else
                    {
                        existing.PriceToman = price.PriceToman;
                    }
                }

                var keptBranchIds = request.Prices.Select(p => p.BranchId).ToHashSet();
                var removed = product.Prices.Where(p => !keptBranchIds.Contains(p.BranchId)).ToList();
                foreach (var price in removed)
                {
                    product.Prices.Remove(price);
                    db.BuffetProductPrices.Remove(price);
                }

                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(product.ToDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Update a buffet product (names, active flag, per-branch prices) — admin.");
    }

    private static Dictionary<string, string[]> ValidateNames(string nameEn, string nameFa)
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
        return errors;
    }
}
