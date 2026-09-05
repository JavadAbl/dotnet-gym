using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Buffet.Domain;
using Gms.Modules.Buffet.Infrastructure;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet.Features;

/// <summary>
/// POST /api/v1/buffet/orders — the buffet POS (counter policy: admin, reception, buffet).
/// Totals are computed server-side from the per-branch catalog prices; the client never
/// dictates money. Payment is cash XOR wallet (locked decision #5); wallet orders debit
/// first and compensate on any later failure (the Phase 3 purchase pattern).
/// </summary>
public static class CreateOrderEndpoint
{
    public sealed record OrderItemRequest(Guid ProductId, int Quantity);

    public sealed record CreateOrderRequest(
        Guid MemberId,
        Guid? BranchId,
        string PaymentMethod,
        IReadOnlyList<OrderItemRequest> Items,
        string? Note);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/buffet/orders", async (
                CreateOrderRequest request,
                ClaimsPrincipal user,
                BuffetDbContext db,
                IMembersModule members,
                IBranchesModule branches,
                ICatalogModule catalog,
                IWalletModule wallet,
                ISalesModule sales,
                CancellationToken cancellationToken) =>
            {
                // ---- items gate: at least one line, quantities 1..99, duplicate products merged
                if (request.Items.Count == 0)
                {
                    throw new GmsException(
                        ErrorCodes.BuffetItemsEmpty,
                        "A buffet order needs at least one item.",
                        400);
                }

                var errors = new Dictionary<string, string[]>();
                foreach (var (item, index) in request.Items.Select((item, index) => (item, index)))
                {
                    if (item.Quantity is < 1 or > 99)
                    {
                        errors[$"items[{index}].quantity"] = ["Quantity must be between 1 and 99."];
                    }
                }

                if (errors.Count > 0)
                {
                    throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                }

                var mergedQuantities = request.Items
                    .GroupBy(i => i.ProductId)
                    .ToDictionary(g => g.Key, g => g.Sum(i => i.Quantity));

                // ---- branch: reception/buffet are pinned to their own branch (JWT claim);
                //      admin (no branch claim) passes an explicit branchId (check-in pattern).
                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var branchId = userBranchId ?? request.BranchId;
                if (branchId is null)
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Branch could not be determined.",
                        400,
                        new Dictionary<string, string[]> { ["branchId"] = ["Select the branch for this order."] });
                }

                if (!await branches.ExistsAsync(branchId.Value, cancellationToken))
                {
                    throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                }

                // ---- member gate: must exist and be Active (same gate as package purchase / top-up)
                var member = await members.GetAsync(request.MemberId, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.BuffetMemberNotFound, "Member not found.", 404);
                if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                {
                    throw new GmsException(
                        ErrorCodes.BuffetMemberInactive,
                        "Only active members can be charged at the buffet.",
                        400);
                }

                // ---- payment method: single method per receipt (locked decision #5)
                var method = BuffetViews.ParsePaymentMethod(request.PaymentMethod);
                if (method is null)
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Payment method must be Cash or Wallet.",
                        400,
                        new Dictionary<string, string[]> { ["paymentMethod"] = ["Cash or Wallet are the only accepted values."] });
                }

                // ---- price resolution through the Catalog contract (per-branch pricing, locked decision #4)
                var now = DateTime.UtcNow;
                long totalToman = 0;
                var lines = new List<(Guid ProductId, string NameEn, string NameFa, int Quantity, long UnitPrice, long LineTotal)>();
                foreach (var (productId, quantity) in mergedQuantities)
                {
                    var product = await catalog.GetProductAsync(productId, cancellationToken)
                        ?? throw new GmsException(ErrorCodes.ProductNotFound, "Buffet product not found.", 404);
                    if (!product.IsActive)
                    {
                        throw new GmsException(
                            ErrorCodes.BuffetProductInactive,
                            $"Buffet product '{product.NameEn}' is no longer sold.",
                            400);
                    }

                    var price = product.Prices.FirstOrDefault(p => p.BranchId == branchId)
                        ?? throw new GmsException(
                            ErrorCodes.BuffetProductNotPricedInBranch,
                            $"Buffet product '{product.NameEn}' has no price for the selected branch.",
                            400);

                    var lineTotal = checked(price.PriceToman * quantity);
                    totalToman = checked(totalToman + lineTotal);
                    lines.Add((product.Id, product.NameEn, product.NameFa, quantity, price.PriceToman, lineTotal));
                }

                var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
                var order = new BuffetOrder
                {
                    MemberId = member.Id,
                    BranchId = branchId.Value,
                    PaymentMethod = method.Value,
                    TotalToman = totalToman,
                    Note = note,
                };
                var items = lines.Select(line => new BuffetOrderItem
                {
                    OrderId = order.Id,
                    ProductId = line.ProductId,
                    ProductNameEn = line.NameEn,
                    ProductNameFa = line.NameFa,
                    UnitPriceToman = line.UnitPrice,
                    Quantity = line.Quantity,
                    LineTotalToman = line.LineTotal,
                }).ToList();

                async Task PersistOrderAsync()
                {
                    db.Orders.Add(order);
                    db.Items.AddRange(items);
                    await db.SaveChangesAsync(cancellationToken);
                }

                async Task CompensateAsync()
                {
                    // The POS order never happened — remove whatever was persisted. The order and
                    // its items are in-module rows (own database), so the delete is legitimate.
                    await db.Items.Where(i => i.OrderId == order.Id).ExecuteDeleteAsync(CancellationToken.None);
                    await db.Orders.Where(o => o.Id == order.Id).ExecuteDeleteAsync(CancellationToken.None);
                }

                if (method == BuffetPaymentMethod.Wallet)
                {
                    // Charge first (throws wallet.insufficient_balance on 409); the ledger row links
                    // to the receipt once it exists (two-step, same as the Wallet top-up flow).
                    var transactionId = await wallet.DebitAsync(
                        member.Id, totalToman, WalletTransactionKinds.BuffetPurchase,
                        note: $"Buffet order: {lines.Count} item(s)", cancellationToken);

                    try
                    {
                        await PersistOrderAsync();
                        var receipt = await sales.CreateBuffetReceiptAsync(
                            member.Id, branchId.Value, totalToman, method.Value.ToString(), note, cancellationToken);

                        order.ReceiptId = receipt.ReceiptId; // keep the in-memory view consistent too
                        await db.Orders
                            .Where(o => o.Id == order.Id)
                            .ExecuteUpdateAsync(
                                setters => setters.SetProperty(o => o.ReceiptId, receipt.ReceiptId),
                                cancellationToken);
                        await wallet.LinkReceiptAsync(transactionId, receipt.ReceiptId, cancellationToken);
                    }
                    catch
                    {
                        await CompensateAsync();
                        await wallet.CreditAsync(
                            member.Id, totalToman, WalletTransactionKinds.BuffetPurchase,
                            note: "Compensation: buffet order failed after debit.", CancellationToken.None);
                        throw;
                    }
                }
                else
                {
                    try
                    {
                        await PersistOrderAsync();
                        var receipt = await sales.CreateBuffetReceiptAsync(
                            member.Id, branchId.Value, totalToman, method.Value.ToString(), note, cancellationToken);

                        order.ReceiptId = receipt.ReceiptId; // keep the in-memory view consistent too
                        await db.Orders
                            .Where(o => o.Id == order.Id)
                            .ExecuteUpdateAsync(
                                setters => setters.SetProperty(o => o.ReceiptId, receipt.ReceiptId),
                                cancellationToken);
                    }
                    catch
                    {
                        await CompensateAsync();
                        throw;
                    }
                }

                var lookup = await BuffetViews.LoadLookupAsync(members, branches, [order.MemberId], cancellationToken);
                var view = order.ToView(lookup, items);

                return Results.Created($"/api/v1/buffet/orders/{order.Id}", view);
            })
            .RequireAuthorization(Policies.Counter)
            .WithTags("Buffet")
            .WithSummary("Create a buffet POS order (cash XOR wallet; server-side per-branch pricing).");
    }
}
