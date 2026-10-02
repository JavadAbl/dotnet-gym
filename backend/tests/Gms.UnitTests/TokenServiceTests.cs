using Gms.Modules.Identity.Application;
using Gms.Modules.Identity.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Gms.UnitTests;

public sealed class TokenServiceTests
{
    private static TokenService CreateService() => new(Options.Create(new JwtOptions
    {
        Issuer = "test.issuer",
        Audience = "test.audience",
        Key = "unit-test-signing-key-that-is-definitely-long-enough-1234567890",
        AccessTokenMinutes = 30,
        RefreshTokenDays = 7,
    }));

    [Fact]
    public void CreateAccessToken_ContainsIdentityAndRoleClaims()
    {
        var service = CreateService();
        var user = new User { UserName = "admin", FullName = "Test User", Roles = ["Admin"] };

        var (token, expiresAt) = service.CreateAccessToken(user, branchId: null);

        var jwt = new JsonWebToken(token);
        Assert.Equal(user.Id.ToString(), jwt.Subject);
        Assert.Equal("test.issuer", jwt.Issuer);
        Assert.Equal("Test User", jwt.GetClaim("name").Value);
        Assert.Equal("Admin", jwt.Claims.First(c => c.Type == "role").Value);
        Assert.True(expiresAt > DateTime.UtcNow.AddMinutes(25));
    }

    [Fact]
    public void CreateAccessToken_WithBranch_IncludesBranchClaim()
    {
        var service = CreateService();
        var user = new User { FullName = "Coach", Roles = ["Coach"] };
        var branchId = Guid.NewGuid();

        var (token, _) = service.CreateAccessToken(user, branchId);

        var jwt = new JsonWebToken(token);
        Assert.Equal(branchId.ToString(), jwt.GetClaim("branchId").Value);
    }

    [Fact]
    public void RefreshTokenHash_IsDeterministicSha256()
    {
        Assert.Equal(TokenService.Hash("abc"), TokenService.Hash("abc"));
        Assert.NotEqual(TokenService.Hash("abc"), TokenService.Hash("abd"));
    }
}
