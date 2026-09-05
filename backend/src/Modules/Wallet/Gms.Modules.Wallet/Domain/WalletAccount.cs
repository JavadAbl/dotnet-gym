using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Wallet.Domain;

/// <summary>
/// A member's stored-value account. One per member (unique MemberId).
/// Balance is integer Toman (locked decision #2) — never floats.
/// </summary>
public class WalletAccount : Entity
{
    public Guid MemberId { get; set; }

    public long BalanceToman { get; set; }
}
