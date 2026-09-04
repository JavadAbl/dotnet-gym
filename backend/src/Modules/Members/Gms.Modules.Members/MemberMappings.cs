using Gms.Modules.Members.Domain;

namespace Gms.Modules.Members;

/// <summary>Hand-written mapping extensions — no AutoMapper in GMS (locked engineering rule).</summary>
public static class MemberMappings
{
    public static Public.MemberPublicDto ToPublicDto(this Domain.Member member) =>
        new(
            member.Id,
            member.Code,
            member.FullName,
            member.PhoneNumber,
            member.Gender.ToString(),
            member.BirthDateUtc,
            member.JoinDateUtc,
            member.HomeBranchId,
            member.CardCode,
            member.Status.ToString(),
            member.Notes);
}
