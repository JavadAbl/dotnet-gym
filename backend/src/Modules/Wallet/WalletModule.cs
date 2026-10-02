using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Wallet;

public static class WalletModule
{
    /// <summary>Wired when the Wallet module phase starts.</summary>
    public static IServiceCollection AddWalletModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapWalletModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
