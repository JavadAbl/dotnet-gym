using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Catalog;

public static class CatalogModule
{
    /// <summary>Wired when the Catalog module phase starts.</summary>
    public static IServiceCollection AddCatalogModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapCatalogModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
