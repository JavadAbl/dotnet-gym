using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Gms.IntegrationTests;

public sealed class GmsApiFactory : WebApplicationFactory<Program>
{
    public string DatabasePath { get; } = Path.Combine(
        Path.GetFullPath("../../../../.testdata"),
        $"gms-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(DatabasePath)!);
        builder.UseSetting("Database:Path", DatabasePath);
        builder.UseEnvironment("Development");
    }
}
