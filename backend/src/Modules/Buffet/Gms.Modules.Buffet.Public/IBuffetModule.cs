namespace Gms.Modules.Buffet.Public;

public record BuffetOrderItemDto(
    Guid ProductId,
    string NameEn,
    string NameFa,
    int Quantity,
    long UnitPriceToman,
    long LineTotalToman);

public record BuffetOrderDto(
    Guid Id,
    Guid MemberId,
    Guid BranchId,
    string PaymentMethod,
    long TotalToman,
    Guid? ReceiptId,
    string? Note,
    DateTime CreatedAtUtc,
    IReadOnlyList<BuffetOrderItemDto> Items);

/// <summary>
/// Buffet module contract (Phase 7). Orders are priced from per-branch BuffetProductPrice via
/// the Catalog contract at order time; payment is cash XOR wallet (single method per receipt,
/// locked decision #5); no inventory tracking (locked decision #7). Dashboards (Phase 8)
/// consume <see cref="GetForMemberAsync"/>; more analytics hooks can be added non-breakingly.
/// </summary>
public interface IBuffetModule
{
    /// <summary>Recent buffet orders of a member, newest first (member sheet / dashboards).</summary>
    Task<IReadOnlyList<BuffetOrderDto>> GetForMemberAsync(
        Guid memberId, int limit = 5, CancellationToken cancellationToken = default);
}
