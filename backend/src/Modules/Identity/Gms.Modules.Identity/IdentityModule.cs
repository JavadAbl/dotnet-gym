using Gms.Modules.Identity.Features;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity;

public static class IdentityModule
{
    /// <summary>Registers the Identity module. Call once from the API host.</summary>
    public static IServiceCollection AddIdentityModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<IdentityDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IIdentityModule, IdentityModuleApi>();
        services.AddScoped<TokenService>();
        return services;
    }

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        LoginEndpoint.Map(app);
        MeEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract.</summary>
internal sealed class IdentityModuleApi(IdentityDbContext db) : Public.IIdentityModule
{
    public async Task<Public.AuthUserDto?> GetAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        return user?.ToDto();
    }
}
