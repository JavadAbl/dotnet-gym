using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Gms.IntegrationTests;

public sealed class AuthFlowTests(GmsApiFactory factory) : IClassFixture<GmsApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private sealed record AuthResponseDto(UserDto User, string AccessToken, DateTime ExpiresAtUtc, string RefreshToken);
    private sealed record UserDto(Guid Id, string? UserName, string FullName, string? Phone, List<string> Roles);
    private sealed record MeDto(Guid Id, string FullName, List<string> Roles, Guid? BranchId);
    private sealed record BranchDto(Guid Id, string Name, bool IsActive);
    private sealed record ErrorBody(string? Title, int? Status, string? Detail, string? ErrorCode);

    private async Task<AuthResponseDto> LoginAsAdminAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "admin", password = "Admin@123" });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
        return body!;
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_Returns401WithErrorCode()
    {
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { userName = "admin", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal("AUTH_INVALID_CREDENTIALS", body!.ErrorCode);
    }

    [Fact]
    public async Task Login_WithValidAdmin_ReturnsTokensAndRoles()
    {
        var auth = await LoginAsAdminAsync();
        Assert.False(string.IsNullOrWhiteSpace(auth.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(auth.RefreshToken));
        Assert.Contains("Admin", auth.User.Roles);
        Assert.Equal("System Administrator", auth.User.FullName);
    }

    [Fact]
    public async Task Me_WithAccessToken_ReturnsCurrentUser()
    {
        var auth = await LoginAsAdminAsync();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var me = await _client.GetFromJsonAsync<MeDto>("/api/v1/me");

        Assert.NotNull(me);
        Assert.Equal(auth.User.Id, me!.Id);
        Assert.Equal("System Administrator", me.FullName);
    }

    [Fact]
    public async Task Me_WithoutToken_Returns401ProblemDetails()
    {
        var response = await _client.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal("AUTH_UNAUTHENTICATED", body!.ErrorCode);
    }

    [Fact]
    public async Task Refresh_RotatesToken_OldRefreshBecomesUnusable()
    {
        var auth = await LoginAsAdminAsync();

        var first = await _client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await _client.PostAsJsonAsync("/api/v1/auth/refresh", new { refreshToken = auth.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, second.StatusCode);
    }

    [Fact]
    public async Task Branches_RequireAuthentication_AndReturnSeededBranches()
    {
        var anonymous = await _client.GetAsync("/api/v1/branches");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);

        var auth = await LoginAsAdminAsync();
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        var branches = await _client.GetFromJsonAsync<List<BranchDto>>("/api/v1/branches");
        Assert.NotNull(branches);
        Assert.Contains(branches!, b => b.Name == "North");
        Assert.Contains(branches!, b => b.Name == "South");
    }
}
