using System.Data;
using Gms.Api.Infrastructure.Auditing;
using Gms.BuildingBlocks;
using Gms.Modules.Attendance;
using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches;
using Gms.Modules.Branches.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Buffet;
using Gms.Modules.Buffet.Infrastructure;
using Gms.Modules.Catalog;
using Gms.Modules.Catalog.Infrastructure;
using Gms.Modules.Coaching;
using Gms.Modules.Coaching.Infrastructure;
using Gms.Modules.Identity;
using Gms.Modules.Identity.Infrastructure;
using Gms.Modules.Members;
using Gms.Modules.Members.Infrastructure;
using Gms.Modules.Sales;
using Gms.Modules.Sales.Infrastructure;
using Gms.Modules.Wallet;
using Gms.Modules.Wallet.Infrastructure;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Gms.Api.Extensions;

/// <summary>Startup database bootstrap: WAL pragmas, migrations (with legacy baselining), seeders.</summary>
internal static class Bootstrapper
{
    private const string MigrationsHistoryTable = "__EFMigrationsHistory";
    private const string ProductVersion = "8.0.11";

    public static async Task InitializeDatabasesAsync(IServiceProvider services, IReadOnlyDictionary<string, string> connectionStrings)
    {
        foreach (var connectionString in connectionStrings.Values)
        {
            await SqliteBootstrapper.EnforceWalAsync(connectionString);
        }

        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger("Gms.Bootstrapper");

        // Phase 9: schema creation moved from EnsureCreated to EF Core migrations. Every context
        // (9 modules + audit) is brought up via MigrateAsync; databases created by earlier
        // EnsureCreated builds (tables present, no migrations history) are BASELINED — the
        // defined migrations are stamped as applied so the schema is never re-created.
        using (var scope = services.CreateScope())
        {
            var provider = scope.ServiceProvider;

            await InitializeDatabaseAsync<BranchesDbContext>(provider, logger, "Branches");
            await InitializeDatabaseAsync<IdentityDbContext>(provider, logger, "Identity");
            await InitializeDatabaseAsync<CatalogDbContext>(provider, logger, "Catalog");
            await InitializeDatabaseAsync<MembersDbContext>(provider, logger, "Members");
            await InitializeDatabaseAsync<WalletDbContext>(provider, logger, "Wallet");
            await InitializeDatabaseAsync<SalesDbContext>(provider, logger, "Sales");
            await InitializeDatabaseAsync<AttendanceDbContext>(provider, logger, "Attendance");
            await InitializeDatabaseAsync<CoachingDbContext>(provider, logger, "Coaching");
            await InitializeDatabaseAsync<BuffetDbContext>(provider, logger, "Buffet");
            await InitializeDatabaseAsync<AuditDbContext>(provider, logger, "Audit");
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

    /// <summary>
    /// Brings one database up to date via EF Core migrations. Safe upgrade paths:
    /// • fresh database            → MigrateAsync applies every migration in order;
    /// • legacy EnsureCreated DB   → the Initial migration is stamped as applied (its schema
    ///   matches it), later migrations stay PENDING and are applied for real by MigrateAsync;
    /// • already-migrated DB       → MigrateAsync applies any pending migrations.
    /// </summary>
    private static async Task InitializeDatabaseAsync<TContext>(
        IServiceProvider provider, ILogger logger, string label)
        where TContext : DbContext
    {
        var context = provider.GetRequiredService<TContext>();
        var migrations = context.Database.GetMigrations().ToList();

        if (migrations.Count == 0)
        {
            // No migrations shipped for this context — fall back to the dev bootstrap.
            await context.Database.EnsureCreatedAsync();
            logger.LogInformation("[{Module}] database created via EnsureCreated (no migrations defined).", label);
            return;
        }

        var connection = context.Database.GetDbConnection();
        var openedHere = false;
        try
        {
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
                openedHere = true;
            }

            var hasHistory = await TableExistsAsync(connection, MigrationsHistoryTable);
            var hasUserTables = await HasUserTablesAsync(connection);

            if (hasUserTables && !hasHistory)
            {
                // Legacy EnsureCreated database: its schema was generated from the model at the time
                // EnsureCreated was the bootstrap (pre-Phase-9), which matches the Initial migration's
                // final state — so ONLY Initial is stamped. Migrations added afterwards (v2+) remain
                // pending and MigrateAsync below executes them for real, upgrading the legacy schema.
                await StampMigrationsAsync(connection, [migrations[0]]);
                logger.LogInformation(
                    "[{Module}] legacy EnsureCreated database baselined: Initial stamped, {Pending} later migration(s) pending.",
                    label, migrations.Count - 1);
            }
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
        }

        await context.Database.MigrateAsync();
        logger.LogInformation("[{Module}] database up to date ({Count} migration(s) defined).", label, migrations.Count);
    }

    private static async Task<bool> TableExistsAsync(DbConnection connection, string tableName)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $name";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "$name";
        parameter.Value = tableName;
        command.Parameters.Add(parameter);
        return Convert.ToInt64(await command.ExecuteScalarAsync()) > 0;
    }

    private static async Task<bool> HasUserTablesAsync(DbConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText =
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' " +
            "AND name NOT LIKE 'sqlite_%' AND name <> $history";
        var parameter = command.CreateParameter();
        parameter.ParameterName = "$history";
        parameter.Value = MigrationsHistoryTable;
        command.Parameters.Add(parameter);
        return Convert.ToInt64(await command.ExecuteScalarAsync()) > 0;
    }

    /// <summary>
    /// Records the given migrations in the history table WITHOUT executing them (baseline).
    /// v2 — callers pass only the Initial migration: the schema of a legacy EnsureCreated
    /// database equals Initial's final state, and every later migration must run for real.
    /// Migration ids are compile-time constants owned by this solution (no user input),
    /// so literal interpolation is safe.
    /// </summary>
    private static async Task StampMigrationsAsync(DbConnection connection, IReadOnlyList<string> migrationIds)
    {
        await using var createHistory = connection.CreateCommand();
        createHistory.CommandText =
            $"""
            CREATE TABLE IF NOT EXISTS "{MigrationsHistoryTable}" (
                "MigrationId" TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
                "ProductVersion" TEXT NOT NULL
            );
            """;
        await createHistory.ExecuteNonQueryAsync();

        foreach (var migrationId in migrationIds)
        {
            await using var insert = connection.CreateCommand();
            insert.CommandText =
                $"INSERT OR IGNORE INTO \"{MigrationsHistoryTable}\" (\"MigrationId\", \"ProductVersion\") " +
                $"VALUES ('{migrationId}', '{ProductVersion}')";
            await insert.ExecuteNonQueryAsync();
        }
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
