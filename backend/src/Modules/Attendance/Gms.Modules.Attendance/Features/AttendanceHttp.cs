using Gms.Modules.Attendance.Domain;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;

namespace Gms.Modules.Attendance.Features;

// ---------------------------------------------------------------- enriched HTTP views (locale-neutral: both En/Fa names)

public sealed record AttendanceEntryView(
    Guid Id,
    Guid MemberId,
    Guid MemberPackageId,
    Guid BranchId,
    DateTime CheckInAtUtc,
    DateTime? CheckOutAtUtc,
    int DurationMinutes,
    bool IsPresent,
    string MemberCode,
    string MemberFullName,
    string PackageNameEn,
    string PackageNameFa,
    string BranchNameEn,
    string BranchNameFa,
    int? SessionsTotal,
    int? SessionsUsed,
    int? SessionsRemaining);

public sealed record PresenceBoard(
    IReadOnlyList<AttendanceEntryView> Items,
    int Count,
    int VisitsToday);

// ---------------------------------------------------------------- shared enrichment helpers

/// <summary>Resolved display names for cross-module ids (members, catalog packages, branches).</summary>
internal sealed record AttendanceNameLookup(
    IReadOnlyDictionary<Guid, MemberPublicDto> Members,
    IReadOnlyDictionary<Guid, ExercisePackageDto> Packages,
    IReadOnlyDictionary<Guid, BranchDto> Branches,
    IReadOnlyDictionary<Guid, MemberPackageDto> MemberPackages);

internal static class AttendanceViews
{
    /// <summary>
    /// Batch-resolves member / package / branch names and the referenced member packages
    /// through the public contracts (no cross-module JOINs).
    /// </summary>
    public static async Task<AttendanceNameLookup> LoadLookupAsync(
        IMembersModule members,
        ICatalogModule catalog,
        IBranchesModule branches,
        ISalesModule sales,
        IEnumerable<Guid> memberIds,
        IEnumerable<Guid> memberPackageIds,
        CancellationToken cancellationToken)
    {
        var memberList = await members.GetBatchAsync(memberIds.Distinct().ToList(), cancellationToken);
        var packageList = await catalog.GetPackagesAsync(cancellationToken);
        var branchList = await branches.GetAllAsync(cancellationToken);

        var memberPackageMap = new Dictionary<Guid, MemberPackageDto>();
        foreach (var memberPackageId in memberPackageIds.Distinct())
        {
            var memberPackage = await sales.GetMemberPackageAsync(memberPackageId, cancellationToken);
            if (memberPackage is not null)
            {
                memberPackageMap[memberPackageId] = memberPackage;
            }
        }

        return new AttendanceNameLookup(
            memberList.ToDictionary(m => m.Id),
            packageList.ToDictionary(p => p.Id),
            branchList.ToDictionary(b => b.Id),
            memberPackageMap);
    }

    public static AttendanceEntryView ToView(this AttendanceEntry entry, AttendanceNameLookup lookup, DateTime nowUtc)
    {
        lookup.MemberPackages.TryGetValue(entry.MemberPackageId, out var memberPackage);

        var endUtc = entry.CheckOutAtUtc ?? nowUtc;
        var durationMinutes = (int)Math.Floor(Math.Max(0, (endUtc - entry.CheckInAtUtc).TotalMinutes));

        int? sessionsTotal = memberPackage?.SessionsTotal;
        int? sessionsUsed = memberPackage?.SessionsUsed;
        int? sessionsRemaining = memberPackage is null ? null : Math.Max(0, memberPackage.SessionsTotal - memberPackage.SessionsUsed);

        return new AttendanceEntryView(
            entry.Id,
            entry.MemberId,
            entry.MemberPackageId,
            entry.BranchId,
            entry.CheckInAtUtc,
            entry.CheckOutAtUtc,
            durationMinutes,
            entry.CheckOutAtUtc is null,
            lookup.Members.TryGetValue(entry.MemberId, out var member) ? member.Code : "—",
            lookup.Members.TryGetValue(entry.MemberId, out member) ? member.FullName : "—",
            lookup.Packages.TryGetValue(memberPackage?.PackageId ?? Guid.Empty, out var package) ? package.NameEn : "—",
            lookup.Packages.TryGetValue(memberPackage?.PackageId ?? Guid.Empty, out package) ? package.NameFa : "—",
            lookup.Branches.TryGetValue(entry.BranchId, out var branch) ? branch.NameEn : "—",
            lookup.Branches.TryGetValue(entry.BranchId, out branch) ? branch.NameFa : "—",
            sessionsTotal,
            sessionsUsed,
            sessionsRemaining);
    }
}
