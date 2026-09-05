using Gms.BuildingBlocks;
using Gms.Modules.Wallet.Domain;
using Gms.Modules.Wallet.Features;
using Gms.Modules.Wallet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Wallet;

public static class WalletModule
{
    /// <summary>Registers the Wallet module. Minimal core delivered in Phase 3; completed in Phase 5.</summary>
    public static IServiceCollection AddWalletModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<WalletDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IWalletModule, WalletModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapWalletEndpoints(this IEndpointRouteBuilder app)
    {
        WalletEndpoints.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by Sales now, Buffet in Phase 7).</summary>
internal sealed class WalletModuleApi(WalletDbContext db) : Public.IWalletModule
{
    public async Task<Public.WalletSnapshotDto> GetSnapshotAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var account = await db.WalletAccounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.MemberId == memberId, cancellationToken);
        return account is null
            ? new Public.WalletSnapshotDto(memberId, false, 0)
            : new Public.WalletSnapshotDto(memberId, true, account.BalanceToman);
    }

    public async Task<IReadOnlyList<Public.WalletTransactionDto>> GetRecentTransactionsAsync(
        Guid memberId, int limit = 20, CancellationToken cancellationToken = default)
    {
        var transactions = await db.WalletTransactions.AsNoTracking()
            .Join(db.WalletAccounts.AsNoTracking(),
                t => t.WalletAccountId,
                a => a.Id,
                (t, a) => new { Transaction = t, a.MemberId })
            .Where(x => x.MemberId == memberId)
            .OrderByDescending(x => x.Transaction.CreatedAtUtc)
            .Take(Math.Clamp(limit, 1, 100))
            .Select(x => x.Transaction)
            .ToListAsync(cancellationToken);

        return transactions.Select(t => new Public.WalletTransactionDto(
            t.Id, t.AmountToman, t.Kind.ToString(), t.BalanceAfter, t.RelatedReceiptId, t.Note, t.CreatedAtUtc)).ToList();
    }

    public async Task EnsureAccountAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var exists = await db.WalletAccounts.AsNoTracking()
            .AnyAsync(a => a.MemberId == memberId, cancellationToken);
        if (exists)
        {
            return;
        }

        db.WalletAccounts.Add(new WalletAccount { MemberId = memberId, BalanceToman = 0 });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<Guid> DebitAsync(
        Guid memberId, long amountToman, string kind,
        Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default)
    {
        if (amountToman <= 0)
        {
            throw new GmsException(ErrorCodes.WalletInvalidAmount, "Debit amount must be a positive integer amount of Toman.");
        }

        // Single-writer SQLite + a serializable transaction keeps the read-modify-write safe;
        // the ledger invariant (BalanceAfter) stays exact.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var account = await db.WalletAccounts
            .FirstOrDefaultAsync(a => a.MemberId == memberId, cancellationToken);
        if (account is null)
        {
            throw new GmsException(ErrorCodes.WalletAccountNotFound, "No wallet account exists for this member.", 404);
        }

        if (account.BalanceToman < amountToman)
        {
            throw new GmsException(
                ErrorCodes.WalletInsufficientBalance,
                $"Wallet balance {account.BalanceToman} is insufficient for a {amountToman} Toman debit.",
                409);
        }

        account.BalanceToman -= amountToman;
        var ledgerRow = new WalletTransaction
        {
            WalletAccountId = account.Id,
            AmountToman = -amountToman,
            Kind = ParseKind(kind),
            BalanceAfter = account.BalanceToman,
            RelatedReceiptId = relatedReceiptId,
            Note = note,
        };
        db.WalletTransactions.Add(ledgerRow);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ledgerRow.Id;
    }

    public async Task<Guid> CreditAsync(
        Guid memberId, long amountToman, string kind,
        Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default)
    {
        if (amountToman <= 0)
        {
            throw new GmsException(ErrorCodes.WalletInvalidAmount, "Credit amount must be a positive integer amount of Toman.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var account = await db.WalletAccounts
            .FirstOrDefaultAsync(a => a.MemberId == memberId, cancellationToken);
        if (account is null)
        {
            account = new WalletAccount { MemberId = memberId, BalanceToman = 0 };
            db.WalletAccounts.Add(account);
            await db.SaveChangesAsync(cancellationToken);
        }

        account.BalanceToman += amountToman;
        var ledgerRow = new WalletTransaction
        {
            WalletAccountId = account.Id,
            AmountToman = amountToman,
            Kind = ParseKind(kind),
            BalanceAfter = account.BalanceToman,
            RelatedReceiptId = relatedReceiptId,
            Note = note,
        };
        db.WalletTransactions.Add(ledgerRow);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ledgerRow.Id;
    }

    /// <summary>Phase 7: lets cross-module callers (Buffet POS) attach their receipt to a ledger row.</summary>
    public async Task LinkReceiptAsync(Guid transactionId, Guid receiptId, CancellationToken cancellationToken = default)
    {
        await db.WalletTransactions
            .Where(t => t.Id == transactionId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(t => t.RelatedReceiptId, receiptId), cancellationToken);
    }

    private static WalletTransactionKind ParseKind(string kind) =>
        Enum.TryParse<WalletTransactionKind>(kind, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
            ? parsed
            : throw new GmsException(ErrorCodes.ValidationFailed, $"Unknown wallet transaction kind '{kind}'.");
}
