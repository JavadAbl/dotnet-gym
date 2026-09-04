using Microsoft.Data.Sqlite;

namespace Gms.BuildingBlocks.Data;

/// <summary>
/// Enforces SQLite pragmas once per database file at startup.
/// WAL = concurrent readers while writing (required for multi-module SQLite).
/// </summary>
public static class SqliteBootstrapper
{
    public static async Task EnforceWalAsync(string connectionString)
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            PRAGMA busy_timeout = 5000;
            """;
        await command.ExecuteNonQueryAsync();
    }
}
