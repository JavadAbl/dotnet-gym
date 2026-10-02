using Gms.Modules.Branches.Application;
using Gms.Modules.Branches.Domain;

namespace Gms.Modules.Branches.Application;

/// <summary>Manual mapping extension — AutoMapper is banned in this codebase (project rule).</summary>
public static class BranchMappers
{
    public static BranchDto ToDto(this Branch branch) => new(branch.Id, branch.Name, branch.IsActive);
}
