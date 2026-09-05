using Gms.Modules.Sales;
using Gms.Modules.Sales.Domain;
using Gms.Modules.Sales.Infrastructure;
using Gms.Modules.Sales.Public;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Gms.Core.Tests;

/// <summary>
/// Pins the atomic session-consumption invariant behind the attendance gate (plan §2):
/// a conditional UPDATE — the check and the increment are one statement, so a concurrent
/// swipe can never oversell the last session.
/// </summary>
public class SalesConsumeSessionTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;
    private string _dbPath = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"gms-sales-tests-{Guid.NewGuid():N}.db");
        var services = new ServiceCollection();
        services.AddSalesModule($"Data Source={_dbPath}");
        _provider = services.BuildServiceProvider();

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        await db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _provider.DisposeAsync();
        foreach (var suffix in new[] { "", "-wal", "-shm" })
        {
            try
            {
                File.Delete(_dbPath + suffix);
            }
            catch
            {
                // best-effort cleanup
            }
        }
    }

    private async Task<Guid> SeedPackageAsync(
        MemberPackageStatus status = MemberPackageStatus.Active,
        int sessionsTotal = 12,
        int sessionsUsed = 3,
        DateTime? expiresAtUtc = null)
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();

        var memberPackage = new MemberPackage
        {
            MemberId = Guid.NewGuid(),
            PackageId = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            SessionsTotal = sessionsTotal,
            SessionsUsed = sessionsUsed,
            StartedAtUtc = DateTime.UtcNow.AddDays(-2),
            ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddDays(7),
            Status = status,
            PricePaidToman = 2_500_000,
        };

        db.MemberPackages.Add(memberPackage);
        await db.SaveChangesAsync();
        return memberPackage.Id;
    }

    [Fact]
    public async Task Consume_returns_true_once_and_increments_exactly()
    {
        var id = await SeedPackageAsync(sessionsTotal: 12, sessionsUsed: 3);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.True(await sales.TryConsumeSessionAsync(id));

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        var package = await db.MemberPackages.FindAsync(id);
        Assert.Equal(4, package!.SessionsUsed);
    }

    [Fact]
    public async Task Last_session_consumes_then_next_swipe_is_rejected()
    {
        var id = await SeedPackageAsync(sessionsTotal: 12, sessionsUsed: 11);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.True(await sales.TryConsumeSessionAsync(id));   // the last session
        Assert.False(await sales.TryConsumeSessionAsync(id));  // oversell attempt — atomic guard

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        var package = await db.MemberPackages.FindAsync(id);
        Assert.Equal(12, package!.SessionsUsed);
    }

    [Theory]
    [InlineData(MemberPackageStatus.Frozen)]
    [InlineData(MemberPackageStatus.Refunded)]
    public async Task Frozen_or_refunded_packages_cannot_consume(MemberPackageStatus status)
    {
        var id = await SeedPackageAsync(status: status, sessionsUsed: 0);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.False(await sales.TryConsumeSessionAsync(id));

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        var package = await db.MemberPackages.FindAsync(id);
        Assert.Equal(0, package!.SessionsUsed);
    }

    [Fact]
    public async Task Expired_packages_cannot_consume()
    {
        var id = await SeedPackageAsync(expiresAtUtc: DateTime.UtcNow.AddHours(-1));
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.False(await sales.TryConsumeSessionAsync(id));

        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        var package = await db.MemberPackages.FindAsync(id);
        Assert.Equal(0, package!.SessionsUsed);
    }

    [Fact]
    public async Task Unknown_package_id_returns_false()
    {
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.False(await sales.TryConsumeSessionAsync(Guid.NewGuid()));
    }
}
