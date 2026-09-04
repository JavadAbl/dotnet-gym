namespace Gms.Modules.Wallet.Public;

/// <summary>
/// Wallet module contract — implemented in Phase 5.
/// Money = integer Toman (long); every transaction records BalanceAfter (ledger invariant);
/// debit must be conditional (balance sufficiency) to stay race-free.
/// </summary>
public interface IWalletModule
{
}
