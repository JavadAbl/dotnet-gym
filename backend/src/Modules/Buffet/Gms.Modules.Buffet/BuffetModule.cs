using Gms.BuildingBlocks;
using Gms.Modules.Buffet.Features;
using Gms.Modules.Buffet.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Buffet;

public static class BuffetModule
{
    /// <summary>Registers the Buffet module (Phase 7). Call once from the API host.</summary>
    public static IServiceCollection AddBuffetModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<BuffetDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IBuffetModule, BuffetModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapBuffetEndpoints(this IEndpointRouteBuilder app)
    {
        CreateOrderEndpoint.Map(app);
        SearchOrdersEndpoint.Map(app);
        SummaryEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by member sheet and Phase 8 dashboards).</summary>
internal sealed class BuffetModuleApi(BuffetDbContext db) : Public.IBuffetModule
{
    public async Task<IReadOnlyList<Public.BuffetOrderDto>> GetForMemberAsync(
        Guid memberId, int limit = 5, CancellationToken cancellationToken = default)
    {
        var safeLimit = Math.Clamp(limit, 1, 50);
        var orders = await db.Orders.AsNoTracking()
            .Where(o => o.MemberId == memberId)
            .OrderByDescending(o => o.CreatedAtUtc)
            .Take(safeLimit)
            .ToListAsync(cancellationToken);

        if (orders.Count == 0)
        {
            return Array.Empty<Public.BuffetOrderDto>();
        }

        var orderIds = orders.Select(o => o.Id).ToList();
        var items = await db.Items.AsNoTracking()
            .Where(i => orderIds.Contains(i.OrderId))
            .ToListAsync(cancellationToken);

        return orders.Select(o => new Public.BuffetOrderDto(
            o.Id,
            o.MemberId,
            o.BranchId,
            o.PaymentMethod.ToString(),
            o.TotalToman,
            o.ReceiptId,
            o.Note,
            o.CreatedAtUtc,
            items.Where(i => i.OrderId == o.Id)
                .Select(i => new Public.BuffetOrderItemDto(
                    i.ProductId, i.ProductNameEn, i.ProductNameFa, i.Quantity, i.UnitPriceToman, i.LineTotalToman))
                .ToList())).ToList();
    }
}
