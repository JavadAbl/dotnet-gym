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

    // sales
    public const string SalesMemberInactive = "sales.member_inactive";
    public const string SalesPackageInactive = "sales.package_inactive";
    public const string SalesMemberPackageNotFound = "sales.member_package_not_found";
    public const string SalesInvalidState = "sales.invalid_state";
    public const string SalesPackageExpired = "sales.package_expired";
    public const string SalesAlreadyRefunded = "sales.already_refunded";
    public const string SalesRefundAmountInvalid = "sales.refund_amount_invalid";

    // wallet
    public const string WalletAccountNotFound = "wallet.account_not_found";
    public const string WalletInsufficientBalance = "wallet.insufficient_balance";
    public const string WalletInvalidAmount = "wallet.invalid_amount";
}
