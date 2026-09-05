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
        DateTime? expiresAtUtc = null,
        MemberPackageKind kind = MemberPackageKind.Exercise)
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();

        var memberPackage = new MemberPackage
        {
            MemberId = Guid.NewGuid(),
            PackageId = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            PackageKind = kind,
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

    /// <summary>Re-binds an already-seeded package to a FIXED member id (for the memberId-based coaching consumption).</summary>
    private async Task<Guid> SeedPrivatePackageForMemberAsync(
        Guid memberId,
        MemberPackageStatus status = MemberPackageStatus.Active,
        int sessionsTotal = 30,
        int sessionsUsed = 3,
        DateTime? expiresAtUtc = null)
    {
        using var scope = _provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();

        var memberPackage = new MemberPackage
        {
            MemberId = memberId,
            PackageId = Guid.NewGuid(),
            BranchId = Guid.NewGuid(),
            PackageKind = MemberPackageKind.PrivateCoaching,
            SessionsTotal = sessionsTotal,
            SessionsUsed = sessionsUsed,
            StartedAtUtc = DateTime.UtcNow.AddDays(-2),
            ExpiresAtUtc = expiresAtUtc ?? DateTime.UtcNow.AddDays(7),
            Status = status,
            PricePaidToman = 15_000_000,
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

/// <summary>
/// v2 — private-coaching session consumption (Coaching gate): FEFO among the member's
/// usable PrivateCoaching packages, atomic guarded UPDATE, strict kind isolation
/// (exercise packages never pay for coaching and vice versa).
/// </summary>
public class SalesConsumeCoachingSessionTests : IAsyncLifetime
{
    private ServiceProvider _provider = null!;
    private string _dbPath = null!;

    public async Task InitializeAsync()
    {
        _dbPath = Path.Combine(Path.GetTempPath(), $"gms-sales-private-tests-{Guid.NewGuid():N}.db");
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

    private SalesDbContext NewDbContext()
    {
        var scope = _provider.CreateScope();
        return scope.ServiceProvider.GetRequiredService<SalesDbContext>();
    }

    [Fact]
    public async Task Coaching_session_consumes_the_private_package_and_increments_exactly()
    {
        var memberId = Guid.NewGuid();
        await SeedPrivatePackageForMemberAsync(memberId, sessionsTotal: 30, sessionsUsed: 3);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        var consumed = await sales.TryConsumeCoachingSessionAsync(memberId);

        Assert.NotNull(consumed);
        Assert.Equal(30, consumed.SessionsTotal);
        Assert.Equal(4, consumed.SessionsUsed);
    }

    [Fact]
    public async Task Last_private_session_consumes_then_next_log_is_rejected()
    {
        var memberId = Guid.NewGuid();
        await SeedPrivatePackageForMemberAsync(memberId, sessionsTotal: 20, sessionsUsed: 19);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.NotNull(await sales.TryConsumeCoachingSessionAsync(memberId));  // the last session
        Assert.Null(await sales.TryConsumeCoachingSessionAsync(memberId));    // oversell attempt — atomic guard

        using var db = NewDbContext();
        var package = await db.MemberPackages.SingleAsync(mp => mp.MemberId == memberId);
        Assert.Equal(20, package.SessionsUsed);
    }

    [Theory]
    [InlineData(MemberPackageStatus.Frozen)]
    [InlineData(MemberPackageStatus.Refunded)]
    public async Task Frozen_or_refunded_private_packages_cannot_consume(MemberPackageStatus status)
    {
        var memberId = Guid.NewGuid();
        await SeedPrivatePackageForMemberAsync(memberId, status: status, sessionsUsed: 0);
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.Null(await sales.TryConsumeCoachingSessionAsync(memberId));
    }

    [Fact]
    public async Task Expired_private_packages_cannot_consume()
    {
        var memberId = Guid.NewGuid();
        await SeedPrivatePackageForMemberAsync(memberId, expiresAtUtc: DateTime.UtcNow.AddHours(-1));
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        Assert.Null(await sales.TryConsumeCoachingSessionAsync(memberId));
    }

    [Fact]
    public async Task Exercise_packages_never_pay_for_coaching_and_vice_versa()
    {
        // Member holds ONLY an exercise package — the coaching gate must not touch it.
        var memberId = Guid.NewGuid();
        var exercisePackageId = await SeedPackageAsync(sessionsTotal: 12, sessionsUsed: 3);
        var dbSeed = NewDbContext();
        var exercise = await dbSeed.MemberPackages.FindAsync(exercisePackageId);
        exercise!.MemberId = memberId;
        await dbSeed.SaveChangesAsync();
        await dbSeed.DisposeAsync();

        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        // Coaching consumption: rejected, exercise counters untouched.
        Assert.Null(await sales.TryConsumeCoachingSessionAsync(memberId));
        using var db = NewDbContext();
        var afterCoaching = await db.MemberPackages.FindAsync(exercisePackageId);
        Assert.Equal(3, afterCoaching!.SessionsUsed);
        await db.DisposeAsync();

        // And the reverse: private packages never pay for gym entry — TryConsumeSessionAsync
        // is only ever called with the exercise package id the attendance endpoint picked.
        var privateMember = Guid.NewGuid();
        var privatePackageId = await SeedPrivatePackageForMemberAsync(privateMember, sessionsUsed: 0);
        Assert.Null(await sales.TryConsumeCoachingSessionAsync(Guid.NewGuid())); // no private package for THAT member
        using var dbFinal = NewDbContext();
        var privatePackage = await dbFinal.MemberPackages.FindAsync(privatePackageId);
        Assert.Equal(0, privatePackage!.SessionsUsed);
    }

    [Fact]
    public async Task GetActivePrivatePackages_returns_FEFO_usable_package_per_member_only()
    {
        var holderId = Guid.NewGuid();
        var emptyId = Guid.NewGuid();
        var soon = await SeedPrivatePackageForMemberAsync(holderId, sessionsTotal: 30, sessionsUsed: 0,
            expiresAtUtc: DateTime.UtcNow.AddDays(3));
        var later = await SeedPrivatePackageForMemberAsync(holderId, sessionsTotal: 20, sessionsUsed: 0,
            expiresAtUtc: DateTime.UtcNow.AddDays(30));
        var sales = _provider.CreateScope().ServiceProvider.GetRequiredService<ISalesModule>();

        var result = await sales.GetActivePrivatePackagesAsync([holderId, emptyId]);

        var row = Assert.Single(result);                    // the member without a private package is absent
        Assert.Equal(holderId, row.MemberId);
        Assert.Equal(soon, row.Id);                         // soonest expiry wins (FEFO)
        Assert.NotEqual(later, row.Id);
        Assert.Equal("PrivateCoaching", row.PackageKind);
    }
}
