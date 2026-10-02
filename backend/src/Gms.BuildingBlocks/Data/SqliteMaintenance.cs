using Microsoft.Data.Sqlite;

namespace Gms.BuildingBlocks.Data;

public static class SqliteMaintenance
{
    /// <summary>WAL mode is persistent per database file — enable once at startup.</summary>
    public static void EnsureWal(string connectionString)
    {
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA journal_mode=WAL;";
        command.ExecuteScalar();
    }
}
