using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Gms.Modules.Wallet.Public;

namespace Gms.Modules.Sales.Features;

/// <summary>POST /api/v1/sales/member-packages — sell an exercise package to a member (admin, reception).</summary>
public static class PurchaseMemberPackageEndpoint
{
    public sealed record PurchaseRequest(Guid MemberId, Guid PackageId, Guid BranchId, string PaymentMethod);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/sales/member-packages", async (
                PurchaseRequest request,
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                IWalletModule wallet,
                CancellationToken cancellationToken) =>
            {
                // ---- member gate: must exist and be Active
                var member = await members.GetAsync(request.MemberId, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.MemberNotFound, "Member not found.", 404);
                if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                {
                    throw new GmsException(
                        ErrorCodes.SalesMemberInactive,
                        "Only active members can purchase packages.",
                        400);
                }

                // ---- branch gate
                if (!await branches.ExistsAsync(request.BranchId, cancellationToken))
                {
                    throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                }

                // ---- package gate: exists, active, granted to the branch (locked decision #4)
                var package = await catalog.GetPackageAsync(request.PackageId, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.PackageNotFound, "Exercise package not found.", 404);
                if (!package.IsActive)
                {
                    throw new GmsException(ErrorCodes.SalesPackageInactive, "This package is no longer sold.", 400);
                }

                if (!await catalog.IsPackageAvailableInBranchAsync(package.Id, request.BranchId, cancellationToken))
                {
                    throw new GmsException(
                        ErrorCodes.PackageNotAvailableInBranch,
                        "The selected package is not available at the selected branch.",
                        400);
                }

                // ---- payment method: single method per receipt (locked decision #5)
                var method = SalesViews.ParsePaymentMethod(request.PaymentMethod);
                if (method is null)
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Payment method must be Cash or Wallet.",
                        400,
                        new Dictionary<string, string[]> { ["paymentMethod"] = ["Cash or Wallet are the only accepted values."] });
                }

                var now = DateTime.UtcNow;
                var memberPackage = new MemberPackage
                {
                    MemberId = member.Id,
                    PackageId = package.Id,
                    BranchId = request.BranchId,
                    SessionsTotal = package.SessionsCount,
                    SessionsUsed = 0,
                    StartedAtUtc = now,
                    ExpiresAtUtc = now.AddDays(package.DurationDays),
                    Status = MemberPackageStatus.Active,
                    PricePaidToman = package.PriceToman,
                };
                var receipt = new Receipt
                {
                    MemberId = member.Id,
                    BranchId = request.BranchId,
                    MemberPackageId = memberPackage.Id,
                    Kind = ReceiptKind.PackagePurchase,
                    PaymentMethod = method.Value,
                    AmountToman = package.PriceToman,
                };

                if (method == PaymentMethod.Wallet)
                {
                    // Charge first (throws wallet.insufficient_balance on 409), then persist the sales rows.
                    // If the sales save fails we compensate by crediting the wallet back.
                    await wallet.DebitAsync(
                        member.Id, package.PriceToman, WalletTransactionKinds.PackagePurchase,
                        receipt.Id, $"Package purchase: {package.NameEn}", cancellationToken);

                    try
                    {
                        db.MemberPackages.Add(memberPackage);
                        db.Receipts.Add(receipt);
                        await db.SaveChangesAsync(cancellationToken);
                    }
                    catch
                    {
                        await wallet.CreditAsync(
                            member.Id, package.PriceToman, WalletTransactionKinds.PackageRefund,
                            receipt.Id, "Compensation: package purchase failed after debit.", CancellationToken.None);
                        throw;
                    }
                }
                else
                {
                    db.MemberPackages.Add(memberPackage);
                    db.Receipts.Add(receipt);
                    await db.SaveChangesAsync(cancellationToken);
                }

                var lookup = await SalesViews.LoadLookupAsync(
                    members, catalog, branches, [memberPackage.MemberId], cancellationToken);
                var view = memberPackage.ToView(lookup, DateTime.UtcNow);

                return Results.Created($"/api/v1/sales/member-packages/{memberPackage.Id}", view);
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Sell an exercise package to a member (cash XOR wallet receipt).");
    }
}
