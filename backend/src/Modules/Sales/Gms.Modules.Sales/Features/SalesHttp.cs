using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Domain;

namespace Gms.Modules.Sales.Features;

// ---------------------------------------------------------------- enriched HTTP views (locale-neutral: both En/Fa names)

public sealed record MemberPackageView(
    Guid Id,
    Guid MemberId,
    Guid PackageId,
    Guid BranchId,
    string PackageKind,
    int SessionsTotal,
    int SessionsUsed,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc,
    string Status,
    long PricePaidToman,
    string MemberCode,
    string MemberFullName,
    string PackageNameEn,
    string PackageNameFa,
    string BranchNameEn,
    string BranchNameFa,
    bool IsExpired);

public sealed record FreezeView(Guid Id, DateTime FrozenAtUtc, DateTime? UnfrozenAtUtc, int? FrozenDays);

public sealed record RefundView(Guid Id, long AmountToman, string? Reason, DateTime RefundedAtUtc);

public sealed record MemberPackageDetailView(
    MemberPackageView Package,
    IReadOnlyList<FreezeView> Freezes,
    RefundView? Refund,
    IReadOnlyList<ReceiptView> Receipts);

public sealed record ReceiptView(
    Guid Id,
    Guid MemberId,
    Guid BranchId,
    Guid? MemberPackageId,
    string Kind,
    string PaymentMethod,
    long AmountToman,
    string? Note,
    DateTime CreatedAtUtc,
    string MemberCode,
    string MemberFullName,
    string BranchNameEn,
    string BranchNameFa,
    string PackageNameEn,
    string PackageNameFa);

// ---------------------------------------------------------------- shared parsing + enrichment helpers

internal static class SalesViews
{
    public static PaymentMethod? ParsePaymentMethod(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "cash" => PaymentMethod.Cash,
        "wallet" => PaymentMethod.Wallet,
        _ => null,
    };

    /// <summary>v2 — catalog kind string → the Sales-side family snapshot (unknown values fall back to Exercise).</summary>
    public static Domain.MemberPackageKind? ParseKind(string? value) => value?.Trim() switch
    {
        "Exercise" => Domain.MemberPackageKind.Exercise,
        "PrivateCoaching" => Domain.MemberPackageKind.PrivateCoaching,
        _ => null,
    };

    public static MemberPackageStatus? ParseStatus(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "active" => MemberPackageStatus.Active,
        "frozen" => MemberPackageStatus.Frozen,
        "refunded" => MemberPackageStatus.Refunded,
        _ => null,
    };

    /// <summary>Batch-resolves member / package / branch names through the public contracts (no cross-module JOINs).</summary>
    public static async Task<SalesNameLookup> LoadLookupAsync(
        IMembersModule members,
        ICatalogModule catalog,
        IBranchesModule branches,
        IEnumerable<Guid> memberIds,
        CancellationToken cancellationToken)
    {
        var memberList = await members.GetBatchAsync(memberIds.Distinct().ToList(), cancellationToken);
        var packageList = await catalog.GetPackagesAsync(cancellationToken);
        var branchList = await branches.GetAllAsync(cancellationToken);

        return new SalesNameLookup(
            memberList.ToDictionary(m => m.Id),
            packageList.ToDictionary(p => p.Id),
            branchList.ToDictionary(b => b.Id));
    }

    public static MemberPackageView ToView(this MemberPackage mp, SalesNameLookup lookup, DateTime nowUtc) =>
        new(
            mp.Id,
            mp.MemberId,
            mp.PackageId,
            mp.BranchId,
            mp.PackageKind.ToString(),
            mp.SessionsTotal,
            mp.SessionsUsed,
            mp.StartedAtUtc,
            mp.ExpiresAtUtc,
            mp.Status.ToString(),
            mp.PricePaidToman,
            lookup.Members.TryGetValue(mp.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(mp.MemberId, out member) ? member.FullName : "—",
            lookup.Packages.TryGetValue(mp.PackageId, out var package) ? package.NameEn : "—",
            lookup.Packages.TryGetValue(mp.PackageId, out package) ? package.NameFa : "—",
            lookup.Branches.TryGetValue(mp.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(mp.BranchId, out branch) ? branch.NameFa : "—",
            mp.ExpiresAtUtc <= nowUtc);
}

/// <summary>Resolved display names for cross-module ids (members, catalog packages, branches).</summary>
internal sealed record SalesNameLookup(
    IReadOnlyDictionary<Guid, MemberPublicDto> Members,
    IReadOnlyDictionary<Guid, ExercisePackageDto> Packages,
    IReadOnlyDictionary<Guid, BranchDto> Branches);
