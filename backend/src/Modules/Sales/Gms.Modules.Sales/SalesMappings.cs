using Gms.Modules.Sales.Domain;

namespace Gms.Modules.Sales;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS (locked engineering rule).</summary>
public static class SalesMappings
{
    public static Public.MemberPackageDto ToPublicDto(this Domain.MemberPackage memberPackage) =>
        new(
            memberPackage.Id,
            memberPackage.MemberId,
            memberPackage.PackageId,
            memberPackage.BranchId,
            memberPackage.SessionsTotal,
            memberPackage.SessionsUsed,
            memberPackage.StartedAtUtc,
            memberPackage.ExpiresAtUtc,
            memberPackage.Status.ToString(),
            memberPackage.PricePaidToman);
}
