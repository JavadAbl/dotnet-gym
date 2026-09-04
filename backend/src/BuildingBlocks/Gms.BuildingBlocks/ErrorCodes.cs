namespace Gms.BuildingBlocks;

/// <summary>
/// Central registry of machine-readable error codes (ProblemDetails <c>errorCode</c> extension).
/// Mobile clients branch on these values — never on messages.
/// </summary>
public static class ErrorCodes
{
    // generic
    public const string ValidationFailed = "validation.failed";

    // identity
    public const string IdentityInvalidCredentials = "identity.invalid_credentials";
    public const string IdentityUserInactive = "identity.user_inactive";
    public const string IdentityDuplicateUsername = "identity.username.duplicate";

    // branches
    public const string BranchNotFound = "branch.not_found";

    // members
    public const string MemberNotFound = "member.not_found";
    public const string MemberPhoneDuplicate = "member.phone.duplicate";
    public const string MemberCardDuplicate = "member.card.duplicate";
    public const string MemberBlocked = "member.blocked";

    // catalog
    public const string PackageNotFound = "catalog.package_not_found";
    public const string PackageNotAvailableInBranch = "catalog.package_not_available_in_branch";
    public const string ProductNotFound = "catalog.product_not_found";
}
