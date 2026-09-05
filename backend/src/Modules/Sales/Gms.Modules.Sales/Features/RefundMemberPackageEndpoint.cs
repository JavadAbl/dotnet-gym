using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Sales.Features;

/// <summary>POST /api/v1/sales/member-packages/{id}/refund — cancel a package (locked decision #6).</summary>
public static class RefundMemberPackageEndpoint
{
    public sealed record RefundRequest(long? AmountToman, string? Reason);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/sales/member-packages/{id:guid}/refund", async (
                Guid id,
                RefundRequest request,
                HttpContext httpContext,
                SalesDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                IWalletModule wallet,
                CancellationToken cancellationToken) =>
            {
                var memberPackage = await db.MemberPackages
                    .Include(mp => mp.Refund)
                    .FirstOrDefaultAsync(mp => mp.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.SalesMemberPackageNotFound, "Member package not found.", 404);

                if (memberPackage.Status == MemberPackageStatus.Refunded)
                {
                    throw new GmsException(
                        ErrorCodes.SalesAlreadyRefunded,
                        "This package has already been refunded.",
                        409);
                }

                // Default: pro-rata value of the unused sessions (floor, integer Toman).
                long amount;
                if (request.AmountToman is { } requested)
                {
                    if (requested <= 0 || requested > memberPackage.PricePaidToman)
                    {
                        throw new GmsException(
                            ErrorCodes.SalesRefundAmountInvalid,
                            $"Refund amount must be between 1 and {memberPackage.PricePaidToman} Toman.",
                            400);
                    }

                    amount = requested.Value;
                }
                else
                {
                    // Default: pro-rata value of the unused sessions (floor, integer Toman).
                    amount = SalesMath.ProRataRefundDefault(
                        memberPackage.PricePaidToman, memberPackage.SessionsTotal, memberPackage.SessionsUsed);
                }

                // Refund mirrors the ORIGINAL receipt's payment method (locked decision #5).
                var purchaseReceipt = await db.Receipts.AsNoTracking()
                    .Where(r => r.MemberPackageId == memberPackage.Id && r.Kind == ReceiptKind.PackagePurchase)
                    .OrderBy(r => r.CreatedAtUtc)
                    .FirstOrDefaultAsync(cancellationToken);
                var method = purchaseReceipt?.PaymentMethod ?? PaymentMethod.Cash;

                var now = DateTime.UtcNow;
                var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();

                var refund = new Refund
                {
                    MemberPackageId = memberPackage.Id,
                    AmountToman = amount,
                    Reason = reason,
                    RefundedAtUtc = now,
                    RefundedByUserId = ParseUserId(httpContext),
                };
                var receipt = new Receipt
                {
                    MemberId = memberPackage.MemberId,
                    BranchId = memberPackage.BranchId,
                    MemberPackageId = memberPackage.Id,
                    Kind = ReceiptKind.PackageRefund,
                    PaymentMethod = method,
                    AmountToman = amount,
                    Note = reason is null ? "Package refund." : $"Package refund: {reason}",
                };

                memberPackage.Status = MemberPackageStatus.Refunded;
                memberPackage.UpdatedAtUtc = now;

                if (method == PaymentMethod.Wallet && amount > 0)
                {
                    // Credit the wallet back first, then persist; compensate with a debit if the save fails.
                    await wallet.CreditAsync(
                        memberPackage.MemberId, amount, WalletTransactionKinds.PackageRefund,
                        receipt.Id, receipt.Note, cancellationToken);

                    try
                    {
                        db.Refunds.Add(refund);
                        db.Receipts.Add(receipt);
                        await db.SaveChangesAsync(cancellationToken);
                    }
                    catch
                    {
                        await wallet.DebitAsync(
                            memberPackage.MemberId, amount, WalletTransactionKinds.PackagePurchase,
                            receipt.Id, "Compensation: refund persistence failed after credit.", CancellationToken.None);
                        throw;
                    }
                }
                else
                {
                    db.Refunds.Add(refund);
                    db.Receipts.Add(receipt);
                    await db.SaveChangesAsync(cancellationToken);
                }

                var detail = await FreezeMemberPackageEndpoint.BuildDetailAsync(
                    db, members, catalog, branches, memberPackage, cancellationToken);
                return Results.Ok(detail);
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Sales")
            .WithSummary("Refund/cancel a member package (pro-rata default, single mirrored payment method).");
    }

    private static Guid ParseUserId(HttpContext httpContext) =>
        Guid.TryParse(httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : Guid.Empty;
}
