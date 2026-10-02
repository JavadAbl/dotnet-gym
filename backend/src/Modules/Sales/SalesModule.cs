using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Sales;

public static class SalesModule
{
    /// <summary>Wired when the Sales module phase starts.</summary>
    public static IServiceCollection AddSalesModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapSalesModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
