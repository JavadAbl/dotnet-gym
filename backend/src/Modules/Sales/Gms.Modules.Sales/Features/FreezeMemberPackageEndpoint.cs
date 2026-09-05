using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>POST /api/v1/sales/member-packages/{id}/freeze and /unfreeze (locked decision #6).</summary>
public static class FreezeMemberPackageEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        MapFreeze(app);
        MapUnfreeze(app);
    }

    private static void MapFreeze(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/sales/member-packages/{id:guid}/freeze", async (
                Guid id,
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var memberPackage = await db.MemberPackages
                    .Include(mp => mp.Freezes)
                    .FirstOrDefaultAsync(mp => mp.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.SalesMemberPackageNotFound, "Member package not found.", 404);

                if (memberPackage.Status != MemberPackageStatus.Active)
                {
                    throw new GmsException(
                        ErrorCodes.SalesInvalidState,
                        "Only active packages can be frozen.",
                        409);
                }

                if (memberPackage.ExpiresAtUtc <= DateTime.UtcNow)
                {
                    throw new GmsException(
                        ErrorCodes.SalesPackageExpired,
                        "Expired packages cannot be frozen.",
                        409);
                }

                var now = DateTime.UtcNow;
                memberPackage.Status = MemberPackageStatus.Frozen;
                memberPackage.UpdatedAtUtc = now;
                memberPackage.Freezes.Add(new PackageFreeze
                {
                    MemberPackageId = memberPackage.Id,
                    FrozenAtUtc = now,
                });

                await db.SaveChangesAsync(cancellationToken);

                return Results.Ok(await BuildDetailAsync(db, members, catalog, branches, memberPackage, cancellationToken));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Freeze an active member package (suspends validity until unfrozen).");
    }

    private static void MapUnfreeze(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/sales/member-packages/{id:guid}/unfreeze", async (
                Guid id,
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var memberPackage = await db.MemberPackages
                    .Include(mp => mp.Freezes)
                    .FirstOrDefaultAsync(mp => mp.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.SalesMemberPackageNotFound, "Member package not found.", 404);

                if (memberPackage.Status != MemberPackageStatus.Frozen)
                {
                    throw new GmsException(
                        ErrorCodes.SalesInvalidState,
                        "Only frozen packages can be unfrozen.",
                        409);
                }

                var now = DateTime.UtcNow;
                var openFreeze = memberPackage.Freezes
                    .Where(f => f.UnfrozenAtUtc is null)
                    .OrderByDescending(f => f.FrozenAtUtc)
                    .FirstOrDefault();

                var frozenDays = 0;
                if (openFreeze is not null)
                {
                    // Ceiling of the elapsed frozen span, never negative (SalesMath pins the formula).
                    frozenDays = SalesMath.FrozenDays(openFreeze.FrozenAtUtc, now);

                    openFreeze.UnfrozenAtUtc = now;
                    openFreeze.FrozenDays = frozenDays;
                    openFreeze.UpdatedAtUtc = now;
                }

                // Locked decision #6: unfreeze shifts the expiry forward by the frozen days.
                memberPackage.ExpiresAtUtc = memberPackage.ExpiresAtUtc.AddDays(frozenDays);
                memberPackage.Status = MemberPackageStatus.Active;
                memberPackage.UpdatedAtUtc = now;

                await db.SaveChangesAsync(cancellationToken);

                return Results.Ok(await BuildDetailAsync(db, members, catalog, branches, memberPackage, cancellationToken));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Unfreeze a frozen member package; expiry is shifted by the frozen days.");
    }

    internal static async Task<MemberPackageDetailView> BuildDetailAsync(
        SalesDbContext db,
        IMembersModule members,
        ICatalogModule catalog,
        IBranchesModule branches,
        Domain.MemberPackage memberPackage,
        CancellationToken cancellationToken)
    {
        await db.Entry(memberPackage).Collection(mp => mp.Freezes).LoadAsync(cancellationToken);
        await db.Entry(memberPackage).Reference(mp => mp.Refund).LoadAsync(cancellationToken);

        var receipts = await db.Receipts.AsNoTracking()
            .Where(r => r.MemberPackageId == memberPackage.Id)
            .OrderByDescending(r => r.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var lookup = await SalesViews.LoadLookupAsync(
            members, catalog, branches, [memberPackage.MemberId], cancellationToken);
        var now = DateTime.UtcNow;

        var receiptViews = receipts.Select(r => new ReceiptView(
            r.Id,
            r.MemberId,
            r.BranchId,
            r.MemberPackageId,
            r.Kind.ToString(),
            r.PaymentMethod.ToString(),
            r.AmountToman,
            r.Note,
            r.CreatedAtUtc,
            lookup.Members.TryGetValue(r.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(r.MemberId, out member) ? member.FullName : "—",
            lookup.Branches.TryGetValue(r.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(r.BranchId, out branch) ? branch.NameFa : "—",
            lookup.Packages.TryGetValue(memberPackage.PackageId, out var package) ? package.NameEn : "—",
            lookup.Packages.TryGetValue(memberPackage.PackageId, out package) ? package.NameFa : "—")).ToList();

        return new MemberPackageDetailView(
            memberPackage.ToView(lookup, now),
            memberPackage.Freezes
                .OrderByDescending(f => f.FrozenAtUtc)
                .Select(f => new FreezeView(f.Id, f.FrozenAtUtc, f.UnfrozenAtUtc, f.FrozenDays))
                .ToList(),
            memberPackage.Refund is null
                ? null
                : new RefundView(
                    memberPackage.Refund.Id,
                    memberPackage.Refund.AmountToman,
                    memberPackage.Refund.Reason,
                    memberPackage.Refund.RefundedAtUtc),
            receiptViews);
    }
}
