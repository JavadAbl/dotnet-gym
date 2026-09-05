using Gms.BuildingBlocks;
using Gms.Modules.Wallet;
using Gms.Modules.Wallet.Infrastructure;
using Gms.Modules.Wallet.Public;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Gms.Core.Tests;

/// <summary>
/// Wallet ledger invariants against a real SQLite database: exact BalanceAfter chain,
/// insufficient-balance guard (with balance untouched), and amount validation.
/// The public IWalletModule contract is exercised the same way cross-module callers do.
/// </summary>
public class WalletModuleTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;
    private string _dbPath = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"gms-wallet-tests-{Guid.NewGuid():N}.db");
        var services = new ServiceCollection();
        services.AddWalletModule($"Data Source={_dbPath}");
        _provider = services.BuildServiceProvider();

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WalletDbContext>();
        await db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _provider.DisposeAsync();
        foreach (var suffix in new[] { "", "-wal", "-shm" })
        {
            try
            {
                File.Delete(_dbPath + suffix);
            }
            catch
            {
                // best-effort cleanup
            }
        }
    }

    private IWalletModule Wallet
    {
        get
        {
            var scope = _provider.CreateScope();
            var wallet = scope.ServiceProvider.GetRequiredService<IWalletModule>();
            return new ScopedWallet(scope, wallet);
        }
    }

    /// <summary>Keeps the DI scope alive for the duration of the resolved-contract call.</summary>
    private sealed class ScopedWallet(IServiceScope scope, IWalletModule inner) : IWalletModule
    {
        public Task<WalletSnapshotDto> GetSnapshotAsync(Guid memberId, CancellationToken cancellationToken = default) =>
            inner.GetSnapshotAsync(memberId, cancellationToken);

        public Task<IReadOnlyList<WalletTransactionDto>> GetRecentTransactionsAsync(
            Guid memberId, int limit = 20, CancellationToken cancellationToken = default) =>
            inner.GetRecentTransactionsAsync(memberId, limit, cancellationToken);

        public Task EnsureAccountAsync(Guid memberId, CancellationToken cancellationToken = default) =>
            inner.EnsureAccountAsync(memberId, cancellationToken);

        public Task<Guid> DebitAsync(Guid memberId, long amountToman, string kind,
            Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default) =>
            inner.DebitAsync(memberId, amountToman, kind, relatedReceiptId, note, cancellationToken);

        public Task<Guid> CreditAsync(Guid memberId, long amountToman, string kind,
            Guid? relatedReceiptId = null, string? note = null, CancellationToken cancellationToken = default) =>
            inner.CreditAsync(memberId, amountToman, kind, relatedReceiptId, note, cancellationToken);

        public Task LinkReceiptAsync(Guid transactionId, Guid receiptId, CancellationToken cancellationToken = default) =>
            inner.LinkReceiptAsync(transactionId, receiptId);
    }

    [Fact]
    public async Task Credit_then_debit_keeps_exact_BalanceAfter_chain()
    {
        var wallet = Wallet;
        var member = Guid.NewGuid();

        await wallet.EnsureAccountAsync(member);
        await wallet.CreditAsync(member, 5_000_000, "TopUp");
        await wallet.DebitAsync(member, 2_500_000, "PackagePurchase");

        var snapshot = await wallet.GetSnapshotAsync(member);
        Assert.True(snapshot.HasAccount);
        Assert.Equal(2_500_000, snapshot.BalanceToman);

        var ledger = await wallet.GetRecentTransactionsAsync(member, 10);
        Assert.Equal(2, ledger.Count);

        // Order-agnostic assertions (rows can share a UTC timestamp at test speed).
        Assert.Contains(ledger, t => t.AmountToman == 5_000_000 && t.BalanceAfter == 5_000_000 && t.Kind == "TopUp");
        Assert.Contains(ledger, t => t.AmountToman == -2_500_000 && t.BalanceAfter == 2_500_000 && t.Kind == "PackagePurchase");
    }

    [Fact]
    public async Task Debit_beyond_balance_throws_and_leaves_balance_untouched()
    {
        var wallet = Wallet;
        var member = Guid.NewGuid();

        await wallet.CreditAsync(member, 100, "TopUp");

        var failure = await Assert.ThrowsAsync<GmsException>(
            () => wallet.DebitAsync(member, 200, "PackagePurchase"));

        Assert.Equal(ErrorCodes.WalletInsufficientBalance, failure.ErrorCode);
        Assert.Equal(409, failure.StatusCode);

        var snapshot = await wallet.GetSnapshotAsync(member);
        Assert.Equal(100, snapshot.BalanceToman);

        // The failed debit must not have leaked a ledger row.
        var ledger = await wallet.GetRecentTransactionsAsync(member, 10);
        Assert.Single(ledger);
    }

    [Fact]
    public async Task Non_positive_debit_amount_is_rejected()
    {
        var wallet = Wallet;
        var member = Guid.NewGuid();

        var zero = await Assert.ThrowsAsync<GmsException>(() => wallet.DebitAsync(member, 0, "TopUp"));
        Assert.Equal(ErrorCodes.WalletInvalidAmount, zero.ErrorCode);
        Assert.Equal(400, zero.StatusCode);

        var negative = await Assert.ThrowsAsync<GmsException>(() => wallet.DebitAsync(member, -5, "TopUp"));
        Assert.Equal(ErrorCodes.WalletInvalidAmount, negative.ErrorCode);
    }

    [Fact]
    public async Task Snapshot_for_unknown_member_reports_missing_account()
    {
        var wallet = Wallet;

        var snapshot = await wallet.GetSnapshotAsync(Guid.NewGuid());

        Assert.False(snapshot.HasAccount);
        Assert.Equal(0, snapshot.BalanceToman);
    }

    [Fact]
    public async Task Credit_creates_account_on_demand()
    {
        var wallet = Wallet;
        var member = Guid.NewGuid();

        await wallet.CreditAsync(member, 250_000, "TopUp");

        var snapshot = await wallet.GetSnapshotAsync(member);
        Assert.True(snapshot.HasAccount);
        Assert.Equal(250_000, snapshot.BalanceToman);
    }
}
