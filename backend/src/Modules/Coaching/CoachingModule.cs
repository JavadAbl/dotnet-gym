using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Coaching;

public static class CoachingModule
{
    /// <summary>Wired when the Coaching module phase starts.</summary>
    public static IServiceCollection AddCoachingModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapCoachingModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
