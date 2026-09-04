using Gms.Modules.Branches.Domain;

namespace Gms.Modules.Branches;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS.</summary>
public static class BranchMappings
{
    public static Public.BranchDto ToDto(this Domain.Branch branch) =>
        new(branch.Id, branch.NameEn, branch.NameFa, branch.City, branch.PhoneNumber, branch.IsActive);
}
