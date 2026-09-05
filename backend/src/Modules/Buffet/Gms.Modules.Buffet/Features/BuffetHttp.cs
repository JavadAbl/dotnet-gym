using Gms.Modules.Buffet.Domain;
using Gms.Modules.Buffet.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Public;

namespace Gms.Modules.Buffet.Features;

// ---------------------------------------------------------------- enriched HTTP views (locale-neutral: both En/Fa names)

public sealed record BuffetOrderItemView(
    Guid ProductId,
    string NameEn,
    string NameFa,
    int Quantity,
    long UnitPriceToman,
    long LineTotalToman);

public sealed record BuffetOrderView(
    Guid Id,
    Guid MemberId,
    Guid BranchId,
    string PaymentMethod,
    long TotalToman,
    Guid? ReceiptId,
    string? Note,
    DateTime CreatedAtUtc,
    IReadOnlyList<BuffetOrderItemView> Items,
    string MemberCode,
    string MemberFullName,
    string BranchNameEn,
    string BranchNameFa);

/// <summary>Counter KPIs for today (UTC). Branch-scoped for reception/buffet, whole chain for admin.</summary>
public sealed record BuffetSummary(
    int OrdersToday,
    long RevenueTodayToman,
    long CashRevenueTodayToman,
    long WalletRevenueTodayToman);

// ---------------------------------------------------------------- shared helpers

internal static class BuffetViews
{
    public static BuffetPaymentMethod? ParsePaymentMethod(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "cash" => BuffetPaymentMethod.Cash,
        "wallet" => BuffetPaymentMethod.Wallet,
        _ => null,
    };

    /// <summary>Batch-resolves member / branch names through the public contracts (no cross-module JOINs).</summary>
    public static async Task<BuffetLookup> LoadLookupAsync(
        IMembersModule members,
        IBranchesModule branches,
        IEnumerable<Guid> memberIds,
        CancellationToken cancellationToken)
    {
        var memberList = await members.GetBatchAsync(memberIds.Distinct().ToList(), cancellationToken);
        var branchList = await branches.GetAllAsync(cancellationToken);
        return new BuffetLookup(
            memberList.ToDictionary(m => m.Id),
            branchList.ToDictionary(b => b.Id));
    }

    public static BuffetOrderView ToView(this BuffetOrder order, BuffetLookup lookup, IReadOnlyList<BuffetOrderItem> items) =>
        new(
            order.Id,
            order.MemberId,
            order.BranchId,
            order.PaymentMethod.ToString(),
            order.TotalToman,
            order.ReceiptId,
            order.Note,
            order.CreatedAtUtc,
            items.Select(i => new BuffetOrderItemView(
                i.ProductId, i.ProductNameEn, i.ProductNameFa, i.Quantity, i.UnitPriceToman, i.LineTotalToman)).ToList(),
            lookup.Members.TryGetValue(order.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(order.MemberId, out member) ? member.FullName : "—",
            lookup.Branches.TryGetValue(order.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(order.BranchId, out branch) ? branch.NameFa : "—");
}

/// <summary>Resolved display names for cross-module ids (members, branches).</summary>
internal sealed record BuffetLookup(
    IReadOnlyDictionary<Guid, MemberPublicDto> Members,
    IReadOnlyDictionary<Guid, BranchDto> Branches);
