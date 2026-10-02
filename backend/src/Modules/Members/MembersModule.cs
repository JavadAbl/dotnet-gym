using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Members;

public static class MembersModule
{
    /// <summary>Wired when the Members module phase starts.</summary>
    public static IServiceCollection AddMembersModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapMembersModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
