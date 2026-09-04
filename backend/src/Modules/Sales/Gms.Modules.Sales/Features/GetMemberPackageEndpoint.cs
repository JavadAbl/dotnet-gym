using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>GET /api/v1/sales/member-packages/{id} — package detail with freezes, refund and receipts.</summary>
public static class GetMemberPackageEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/sales/member-packages/{id:guid}", async (
                Guid id,
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var memberPackage = await db.MemberPackages.AsNoTracking()
                    .Include(mp => mp.Freezes)
                    .Include(mp => mp.Refund)
                    .FirstOrDefaultAsync(mp => mp.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.SalesMemberPackageNotFound, "Member package not found.", 404);

                var receipts = await db.Receipts.AsNoTracking()
                    .Where(r => r.MemberPackageId == id)
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

                var detail = new MemberPackageDetailView(
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

                return Results.Ok(detail);
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Member package detail: freezes, refund and receipts.");
    }
}
