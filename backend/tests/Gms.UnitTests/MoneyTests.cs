using Gms.BuildingBlocks.Money;

namespace Gms.UnitTests;

public sealed class MoneyTests
{
    [Fact]
    public void Addition_SumsTomanAmounts()
    {
        var sum = new Money(1_200_000) + new Money(800_000);
        Assert.Equal(2_000_000L, sum.AmountToman);
    }

    [Fact]
    public void Subtraction_CanProduceNegative_ButNegativeIsFlagged()
    {
        var diff = new Money(500_000) - new Money(750_000);
        Assert.True(diff.IsNegative);
        Assert.Equal(-250_000L, diff.AmountToman);
    }

    [Fact]
    public void Zero_HasNoAmount()
    {
        Assert.Equal(0L, Money.Zero.AmountToman);
    }
}
