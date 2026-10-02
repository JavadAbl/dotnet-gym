namespace Gms.BuildingBlocks.Money;

/// <summary>
/// All amounts in GMS are integer Toman (no minor units). Stored as long in SQLite,
/// which has no native decimal type — never introduce decimal for money.
/// </summary>
public readonly record struct Money(long AmountToman) : IComparable<Money>
{
    public static Money Zero => default;

    public bool IsNegative => AmountToman < 0;

    public static Money operator +(Money a, Money b) => new(a.AmountToman + b.AmountToman);
    public static Money operator -(Money a, Money b) => new(a.AmountToman - b.AmountToman);

    public int CompareTo(Money other) => AmountToman.CompareTo(other.AmountToman);

    public override string ToString() => $"{AmountToman:N0} T";
}
