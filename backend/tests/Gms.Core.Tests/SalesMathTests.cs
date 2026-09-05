using Gms.Modules.Sales.Domain;
using Xunit;

namespace Gms.Core.Tests;

/// <summary>Pins the pro-rata refund and freeze-shift formulas (locked decisions #2 and #6).</summary>
public class SalesMathTests
{
    // ---------------------------------------------------------------- pro-rata refund default

    [Fact]
    public void ProRata_full_package_unused_returns_full_price()
    {
        Assert.Equal(2_500_000, SalesMath.ProRataRefundDefault(2_500_000, sessionsTotal: 12, sessionsUsed: 0));
    }

    [Fact]
    public void ProRata_partial_usage_floors_to_whole_toman()
    {
        // 2,500,000 × 7/12 = 1,458,333.33… → floor 1,458,333 (integer Toman, locked decision #2).
        Assert.Equal(1_458_333, SalesMath.ProRataRefundDefault(2_500_000, 12, 5));
        Assert.Equal(2_291_666, SalesMath.ProRataRefundDefault(2_500_000, 12, 1));
        Assert.Equal(600_000, SalesMath.ProRataRefundDefault(1_200_000, 8, 4));
    }

    [Fact]
    public void ProRata_repeating_fraction_floors()
    {
        // 1,000,000 × 3/3 → 1,000,000; 1,000,000 × 1/3 = 333,333.33… → 333,333.
        Assert.Equal(1_000_000, SalesMath.ProRataRefundDefault(1_000_000, 3, 0));
        Assert.Equal(333_333, SalesMath.ProRataRefundDefault(1_000_000, 3, 2));
    }

    [Fact]
    public void ProRata_fully_used_or_overused_returns_zero()
    {
        Assert.Equal(0, SalesMath.ProRataRefundDefault(2_500_000, 12, 12));
        Assert.Equal(0, SalesMath.ProRataRefundDefault(2_500_000, 12, 15));
    }

    [Fact]
    public void ProRata_zero_session_total_returns_zero()
    {
        Assert.Equal(0, SalesMath.ProRataRefundDefault(500_000, 0, 0));
    }

    // ---------------------------------------------------------------- freeze shift (locked decision #6)

    [Fact]
    public void FrozenDays_zero_span_is_zero()
    {
        var at = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc);
        Assert.Equal(0, SalesMath.FrozenDays(at, at));
    }

    [Fact]
    public void FrozenDays_ceilings_partial_days()
    {
        var frozenAt = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);

        // 23 h = 0.96 days → ceiling 1 (a frozen evening still costs one whole frozen day).
        Assert.Equal(1, SalesMath.FrozenDays(frozenAt, frozenAt.AddHours(23)));

        // Exactly 2 days and 25 h both round per ceiling.
        Assert.Equal(2, SalesMath.FrozenDays(frozenAt, frozenAt.AddHours(48)));
        Assert.Equal(2, SalesMath.FrozenDays(frozenAt, frozenAt.AddHours(25)));
        Assert.Equal(7, SalesMath.FrozenDays(frozenAt, frozenAt.AddDays(7)));
    }

    [Fact]
    public void FrozenDays_never_negative_on_clock_skew()
    {
        var frozenAt = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        Assert.Equal(0, SalesMath.FrozenDays(frozenAt, frozenAt.AddHours(-3)));
    }
}
