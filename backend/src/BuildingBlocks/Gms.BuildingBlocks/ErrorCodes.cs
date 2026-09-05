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
    public const string WalletMemberNotFound = "wallet.member_not_found";
    public const string WalletMemberInactive = "wallet.member_inactive";
    public const string WalletAccountNotFound = "wallet.account_not_found";
    public const string WalletInsufficientBalance = "wallet.insufficient_balance";
    public const string WalletInvalidAmount = "wallet.invalid_amount";

    // attendance
    public const string AttendanceMemberNotFound = "attendance.member_not_found";
    public const string AttendanceMemberInactive = "attendance.member_inactive";
    public const string AttendanceAlreadyCheckedIn = "attendance.already_checked_in";
    public const string AttendanceNoActivePackage = "attendance.no_active_package";
    public const string AttendancePackageFrozen = "attendance.package_frozen";
    public const string AttendancePackageExpired = "attendance.package_expired";
    public const string AttendanceNoSessionsRemaining = "attendance.no_sessions_remaining";
    public const string AttendanceBranchNotAllowed = "attendance.branch_not_allowed";
    public const string AttendanceEntryConflict = "attendance.entry_conflict";
    public const string AttendanceEntryNotFound = "attendance.entry_not_found";
    public const string AttendanceAlreadyCheckedOut = "attendance.already_checked_out";

    // coaching (Phase 6)
    public const string CoachingCoachNotFound = "coaching.coach_not_found";
    public const string CoachingMemberNotFound = "coaching.member_not_found";
    public const string CoachingMemberInactive = "coaching.member_inactive";
    public const string CoachingAssignmentNotFound = "coaching.assignment_not_found";
    public const string CoachingAssignmentExists = "coaching.assignment_exists";
    public const string CoachingAlreadyReleased = "coaching.already_released";
    public const string CoachingMemberNotAssigned = "coaching.member_not_assigned";
    public const string CoachingPlanNotFound = "coaching.plan_not_found";
    public const string CoachingPlanNotActive = "coaching.plan_not_active";
    public const string CoachingRecordNotFound = "coaching.record_not_found";
    public const string CoachingForbidden = "coaching.forbidden";

    // buffet (Phase 7)
    public const string BuffetMemberNotFound = "buffet.member_not_found";
    public const string BuffetMemberInactive = "buffet.member_inactive";
    public const string BuffetItemsEmpty = "buffet.items_empty";
    public const string BuffetInvalidQuantity = "buffet.invalid_quantity";
    public const string BuffetProductInactive = "buffet.product_inactive";
    public const string BuffetProductNotPricedInBranch = "buffet.product_not_priced_in_branch";
}
