namespace Gms.BuildingBlocks;

/// <summary>Standard paging envelope for all list endpoints.</summary>
public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);

/// <summary>Standard roles across the system. JWT <c>role</c> claim carries one of these.</summary>
public static class UserRoles
{
    public const string Admin = "admin";
    public const string Reception = "reception";
    public const string Buffet = "buffet";
    public const string Coach = "coach";
}

/// <summary>Named authorization policies wired in the API host.</summary>
public static class Policies
{
    public const string Admin = "AdminOnly";
    public const string Management = "AdminOrReception";
    public const string Staff = "StaffAny";
}
