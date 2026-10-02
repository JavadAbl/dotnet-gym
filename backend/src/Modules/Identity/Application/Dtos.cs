namespace Gms.Modules.Identity.Application;

public sealed record LoginRequest(string UserName, string Password);
public sealed record RefreshRequest(string RefreshToken);
public sealed record LogoutRequest(string RefreshToken);

public sealed record UserDto(Guid Id, string? UserName, string FullName, string? Phone, IReadOnlyList<string> Roles);
public sealed record AuthResponse(UserDto User, string AccessToken, DateTime ExpiresAtUtc, string RefreshToken);
public sealed record MeResponse(Guid Id, string FullName, IReadOnlyList<string> Roles, Guid? BranchId);
