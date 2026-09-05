using Gms.BuildingBlocks;
using Gms.Modules.Attendance;
using Gms.Modules.Branches;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog;
using Gms.Modules.Coaching;
using Gms.Modules.Identity;
using Gms.Modules.Members;
using Gms.Modules.Sales;
using Gms.Modules.Wallet;
using Microsoft.AspNetCore.Diagnostics;

namespace Gms.Api.Extensions;

/// <summary>Startup database bootstrap: WAL pragmas, EnsureCreated, seeders (deterministic order).</summary>
internal static class Bootstrapper
{
    public static async Task InitializeDatabasesAsync(IServiceProvider services, IReadOnlyDictionary<string, string> connectionStrings)
    {
        foreach (var connectionString in connectionStrings.Values)
        {
            await SqliteBootstrapper.EnforceWalAsync(connectionString);
        }

        // Seed order matters: branches → identity (links operators) → catalog (grants access)
        // → members (demo data) → wallet (opening balances for demo members) → sales (demo purchases)
        // → attendance (demo visits referencing member packages)
        // → coaching (demo assignments/plans/records referencing members + coach users)
        // → buffet (demo POS orders referencing members, products and wallet balances).
        using (var scope = services.CreateScope())
        {
            await BranchesSeeder.SeedAsync(scope.ServiceProvider);
        }

        // IdentitySeeder needs branch ids through the public contract — resolve from the root provider.
        await IdentitySeeder.SeedAsync(services);

        using (var scope = services.CreateScope())
        {
            var branches = await scope.ServiceProvider.GetRequiredService<IBranchesModule>().GetAllAsync();
            await CatalogSeeder.SeedAsync(scope.ServiceProvider, branches);
        }

        await MembersSeeder.SeedAsync(services);
        await WalletSeeder.SeedAsync(services);
        await SalesSeeder.SeedAsync(services);
        await AttendanceSeeder.SeedAsync(services);
        await CoachingSeeder.SeedAsync(services);
        await BuffetSeeder.SeedAsync(services);
    }
}

/// <summary>Converts GmsException → RFC7807 ProblemDetails with a machine-readable errorCode extension.</summary>
internal sealed class GmsExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not GmsException gmsException)
        {
            return false; // fall through to the default 500 ProblemDetails
        }

        var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = gmsException.StatusCode,
            Title = gmsException.ErrorCode,
            Detail = gmsException.Message,
            Instance = httpContext.Request.Path,
        };
        problem.Extensions["errorCode"] = gmsException.ErrorCode;
        if (gmsException.Errors is { Count: > 0 } errors)
        {
            problem.Extensions["errors"] = errors;
        }

        httpContext.Response.StatusCode = gmsException.StatusCode;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
