namespace Gms.Modules.Buffet.Public;

/// <summary>
/// Buffet module contract — implemented in Phase 7.
/// Orders priced from per-branch BuffetProductPrice; payment = cash XOR wallet (single method per receipt);
/// no inventory tracking (locked decision #7).
/// </summary>
public interface IBuffetModule
{
}
