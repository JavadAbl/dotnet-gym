using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Gms.Modules.Wallet.Domain;
using Gms.Modules.Wallet.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Wallet.Features;

/// <summary>
/// Wallet HTTP surface (Phase 5): snapshot, paged accounts, paged ledger and the top-up flow.
/// All reads stay inside the module (own SQLite file); member/branch data is resolved through
/// the Members / Branches public contracts; the top-up receipt is created through the Sales
/// public contract — zero cross-module JOINs, zero cross-module FKs.
/// </summary>
public static class WalletEndpoints
{
    public sealed record WalletSnapshotResponse(
        Guid MemberId,
        bool HasAccount,
        long BalanceToman,
        IReadOnlyList<WalletTransactionDto> RecentTransactions);

    public sealed record WalletAccountView(
        Guid MemberId,
        string MemberCode,
        string MemberFullName,
        long BalanceToman,
        DateTime? LastActivityAtUtc);

    /// <summary>Accounts page plus the total balance held across the filtered set (workspace KPI).</summary>
    public sealed record WalletAccountsPage(
        IReadOnlyList<WalletAccountView> Items,
        int Page,
        int PageSize,
        int TotalCount,
        long TotalBalanceToman);

    public sealed record TopUpRequest(long AmountToman, Guid? BranchId, string? Note);

    public sealed record TopUpResponse(
        Guid MemberId,
        Guid ReceiptId,
        Guid TransactionId,
        long AmountToman,
        long BalanceToman);

    public static void Map(IEndpointRouteBuilder app)
    {
        // ---------------------------------------------------------------- snapshot (Phase 3, kept)
        app.MapGet("/api/v1/wallet/members/{memberId:guid}", async (
                Guid memberId,
                IWalletModule wallet,
                CancellationToken cancellationToken) =>
            {
                var snapshot = await wallet.GetSnapshotAsync(memberId, cancellationToken);
                var transactions = await wallet.GetRecentTransactionsAsync(memberId, 10, cancellationToken);

                return Results.Ok(new WalletSnapshotResponse(
                    snapshot.MemberId, snapshot.HasAccount, snapshot.BalanceToman, transactions));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Wallet")
            .WithSummary("Wallet snapshot (balance + recent ledger rows) for a member.");

        // ---------------------------------------------------------------- accounts (Phase 5)
        app.MapGet("/api/v1/wallet/accounts", async (
                WalletDbContext db,
                IMembersModule members,
                string? search,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                var query = db.WalletAccounts.AsNoTracking().AsQueryable();

                // Free-text search resolves to member ids through the Members contract —
                // the wallet store never JOINs the members database.
                IReadOnlyList<Guid> searchedMemberIds = Array.Empty<Guid>();
                var hasSearch = !string.IsNullOrWhiteSpace(search);
                if (hasSearch)
                {
                    searchedMemberIds = await members.FindIdsAsync(search.Trim(), cancellationToken);
                    if (searchedMemberIds.Count == 0)
                    {
                        return Results.Ok(new WalletAccountsPage(
                            Array.Empty<WalletAccountView>(), currentPage, currentPageSize, 0, 0));
                    }

                    query = query.Where(a => searchedMemberIds.Contains(a.MemberId));
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var totalBalanceToman = await query.SumAsync(a => a.BalanceToman, cancellationToken);
                var accounts = await query
                    .OrderByDescending(a => a.BalanceToman)
                    .ThenBy(a => a.CreatedAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                // Last ledger activity per account — in-module data (same database).
                var accountIds = accounts.Select(a => a.Id).ToList();
                var lastActivityByAccount = accountIds.Count == 0
                    ? new Dictionary<Guid, DateTime>()
                    : await db.WalletTransactions.AsNoTracking()
                        .Where(t => accountIds.Contains(t.WalletAccountId))
                        .GroupBy(t => t.WalletAccountId)
                        .Select(g => new { WalletAccountId = g.Key, Last = g.Max(t => t.CreatedAtUtc) })
                        .ToDictionaryAsync(x => x.WalletAccountId, x => x.Last, cancellationToken);

                var memberIds = accounts.Select(a => a.MemberId).ToList();
                var memberById = (await members.GetBatchAsync(memberIds, cancellationToken))
                    .ToDictionary(m => m.Id);

                var views = accounts.Select(a =>
                {
                    var member = memberById.GetValueOrDefault(a.MemberId);
                    return new WalletAccountView(
                        a.MemberId,
                        member?.Code ?? "—",
                        member?.FullName ?? "—",
                        a.BalanceToman,
                        lastActivityByAccount.GetValueOrDefault(a.Id));
                }).ToList();

                return Results.Ok(new WalletAccountsPage(
                    views, currentPage, currentPageSize, totalCount, totalBalanceToman));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Wallet")
            .WithSummary("Paged wallet accounts with balances and last ledger activity.");

        // ---------------------------------------------------------------- paged ledger (Phase 5)
        app.MapGet("/api/v1/wallet/members/{memberId:guid}/transactions", async (
                Guid memberId,
                WalletDbContext db,
                string? kind,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                var currentPage = page > 0 ? page : 1;
                var currentPageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

                var account = await db.WalletAccounts.AsNoTracking()
                    .FirstOrDefaultAsync(a => a.MemberId == memberId, cancellationToken);
                if (account is null)
                {
                    // No wallet yet — an empty ledger, not an error (the UI offers a top-up).
                    return Results.Ok(new PagedResult<WalletTransactionDto>(
                        Array.Empty<WalletTransactionDto>(), currentPage, currentPageSize, 0));
                }

                var query = db.WalletTransactions.AsNoTracking()
                    .Where(t => t.WalletAccountId == account.Id);

                if (Enum.TryParse<WalletTransactionKind>(kind, ignoreCase: true, out var kindFilter)
                    && Enum.IsDefined(kindFilter))
                {
                    query = query.Where(t => t.Kind == kindFilter);
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var items = await query
                    .OrderByDescending(t => t.CreatedAtUtc)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                var views = items.Select(t => new WalletTransactionDto(
                    t.Id, t.AmountToman, t.Kind.ToString(), t.BalanceAfter, t.RelatedReceiptId, t.Note,
                    t.CreatedAtUtc)).ToList();

                return Results.Ok(new PagedResult<WalletTransactionDto>(
                    views, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Wallet")
            .WithSummary("Paged ledger for a member's wallet (BalanceAfter invariant per row).");

        // ---------------------------------------------------------------- top-up (Phase 5)
        app.MapPost("/api/v1/wallet/members/{memberId:guid}/top-up", async (
                Guid memberId,
                TopUpRequest request,
                ClaimsPrincipal user,
                IBranchesModule branches,
                IMembersModule members,
                IWalletModule wallet,
                ISalesModule sales,
                WalletDbContext db,
                CancellationToken cancellationToken) =>
            {
                if (request.AmountToman <= 0)
                {
                    throw new GmsException(
                        ErrorCodes.WalletInvalidAmount,
                        "Top-up amount must be a positive integer amount of Toman.",
                        400,
                        new Dictionary<string, string[]> { ["amountToman"] = ["Enter a positive Toman amount."] });
                }

                // ---- branch: reception/coach are pinned to their own branch (JWT claim);
                //      admin (no branch claim) must pass an explicit branchId (check-in pattern).
                Guid? userBranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var claimedBranch)
                    ? claimedBranch
                    : null;
                var branchId = userBranchId ?? request.BranchId;
                if (branchId is null)
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Branch could not be determined.",
                        400,
                        new Dictionary<string, string[]> { ["branchId"] = ["Select the branch for this top-up."] });
                }

                if (!await branches.ExistsAsync(branchId.Value, cancellationToken))
                {
                    throw new GmsException(ErrorCodes.BranchNotFound, "Branch not found.", 404);
                }

                // ---- member gate: must exist and be Active (same gate as package purchase)
                var member = await members.GetAsync(memberId, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.WalletMemberNotFound, "Member not found.", 404);
                if (!string.Equals(member.Status, "Active", StringComparison.Ordinal))
                {
                    throw new GmsException(
                        ErrorCodes.WalletMemberInactive,
                        "Wallets can only be topped up for active members.",
                        400);
                }

                var note = string.IsNullOrWhiteSpace(request.Note) ? "Wallet top-up (cash)" : request.Note.Trim();

                // ---- credit first (creates the account on first credit), then the receipt;
                //      if the receipt fails, take the credit back — the ledger stays exact.
                //      (Mirror image of the purchase flow: debit first, compensate on persist failure.)
                var transactionId = await wallet.CreditAsync(
                    member.Id, request.AmountToman, WalletTransactionKinds.TopUp, note: note, cancellationToken: cancellationToken);
                try
                {
                    var receipt = await sales.CreateTopUpReceiptAsync(
                        member.Id, branchId.Value, request.AmountToman, note, cancellationToken);

                    // Link the ledger row to its receipt (audit trail across the two module databases).
                    await db.WalletTransactions
                        .Where(t => t.Id == transactionId)
                        .ExecuteUpdateAsync(
                            setters => setters.SetProperty(t => t.RelatedReceiptId, receipt.ReceiptId),
                            cancellationToken);

                    var snapshot = await wallet.GetSnapshotAsync(memberId, cancellationToken);
                    return Results.Created(
                        $"/api/v1/wallet/members/{memberId}",
                        new TopUpResponse(memberId, receipt.ReceiptId, transactionId, request.AmountToman, snapshot.BalanceToman));
                }
                catch
                {
                    await wallet.DebitAsync(
                        member.Id, request.AmountToman, WalletTransactionKinds.TopUp,
                        note: "Compensation: top-up receipt failed after credit.",
                        cancellationToken: CancellationToken.None);
                    throw;
                }
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Wallet")
            .WithSummary("Top up a member's wallet with cash: ledger row + TopUp receipt, BalanceAfter exact.");
    }
}
