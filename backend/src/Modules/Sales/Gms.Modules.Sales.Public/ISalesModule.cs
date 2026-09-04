namespace Gms.Modules.Sales.Public;

/// <summary>
/// Sales module contract — implemented in Phase 3.
/// Will expose: member package purchase (single payment method: cash XOR wallet),
/// freeze/unfreeze (expiry shift), refunds, member package queries.
/// Entities: MemberPackage (SessionsTotal/SessionsUsed/Expiry/Status), PackageFreeze, Refund, Receipt.
/// </summary>
public interface ISalesModule
{
}
