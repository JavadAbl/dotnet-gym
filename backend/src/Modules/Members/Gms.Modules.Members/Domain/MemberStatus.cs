namespace Gms.Modules.Members.Domain;

/// <summary>Membership lifecycle. Blocked members cannot check in; Inactive = dormant (e.g. moved away).</summary>
public enum MemberStatus
{
    Active = 1,
    Inactive = 2,
    Blocked = 3,
}

public enum Gender
{
    Unknown = 0,
    Male = 1,
    Female = 2,
}
