using Microsoft.Extensions.DependencyInjection;

namespace Gms.BuildingBlocks.Events;

public static class BuildingBlocksModule
{
    public static IServiceCollection AddBuildingBlocks(this IServiceCollection services)
    {
        services.AddScoped<IEventDispatcher, InProcessEventDispatcher>();
        return services;
    }
}
