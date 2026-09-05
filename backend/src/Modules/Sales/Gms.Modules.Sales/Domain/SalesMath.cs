namespace Gms.Modules.Sales.Domain;

/// <summary>
/// Pure sales arithmetic extracted in Phase 9 (hardening) so unit tests can pin the invariants.
/// Same formulas the endpoints used inline — extraction is behavior-preserving, the endpoints
/// simply delegate here now.
/// </summary>
public static class SalesMath
{
    /// <summary>
    /// Pro-rata refund default: floor(<paramref name="pricePaidToman"/> × remaining sessions /
    /// total sessions), integer Toman (locked decision #2 — never floats). Returns 0 when
    /// nothing remains (or the package had no sessions at all).
    /// </summary>
    public static long ProRataRefundDefault(long pricePaidToman, int sessionsTotal, int sessionsUsed)
    {
        var remaining = Math.Max(0, sessionsTotal - sessionsUsed);
        return sessionsTotal > 0 ? pricePaidToman * remaining / sessionsTotal : 0;
    }

    /// <summary>
    /// Whole frozen days as recorded on unfreeze: ceiling of the elapsed span, never negative
    /// (clock skew safe). Locked decision #6 — frozen time never consumes validity, so the
    /// package expiry is shifted forward by exactly this many days.
    /// </summary>
    public static int FrozenDays(DateTime frozenAtUtc, DateTime unfrozenAtUtc)
    {
        var days = (int)Math.Ceiling((unfrozenAtUtc - frozenAtUtc).TotalDays);
        return Math.Max(0, days);
    }
}
