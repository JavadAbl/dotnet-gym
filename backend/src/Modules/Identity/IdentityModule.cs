using Gms.Modules.Identity.Application;
using Gms.Modules.Identity.Endpoints;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Gms.Modules.Identity;

public static class IdentityModule
{
    public static IServiceCollection AddIdentityModule(
        this IServiceCollection services,
        string sqliteConnectionString,
        JwtOptions jwtOptions)
    {
        services.AddDbContext<IdentityDbContext>(options => options.UseSqlite(
            sqliteConnectionString,
            sqlite => sqlite.MigrationsHistoryTable("__Gms_Identity_Migrations")));

        services.AddSingleton(Options.Create(jwtOptions));
        services.AddScoped<PasswordHasher<Domain.User>>();
        services.AddScoped<TokenService>();
        services.AddScoped<AuthService>();

        return services;
    }

    public static IEndpointRouteBuilder MapIdentityModuleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapAuthEndpoints();
        app.MapMeEndpoint();
        return app;
    }
}
