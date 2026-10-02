using Gms.Modules.Branches.Endpoints;
using Gms.Modules.Branches.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Branches;

public static class BranchesModule
{
    public static IServiceCollection AddBranchesModule(this IServiceCollection services, string sqliteConnectionString)
    {
        services.AddDbContext<BranchesDbContext>(options => options.UseSqlite(
            sqliteConnectionString,
            sqlite => sqlite.MigrationsHistoryTable("__Gms_Branches_Migrations")));

        return services;
    }

    public static IEndpointRouteBuilder MapBranchesModuleEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapBranchEndpoints();
        return app;
    }
}
