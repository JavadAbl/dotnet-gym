using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Buffet;

public static class BuffetModule
{
    /// <summary>Wired when the Buffet module phase starts.</summary>
    public static IServiceCollection AddBuffetModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapBuffetModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
