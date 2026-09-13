using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Identity.Domain;
using Gms.Modules.Identity.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Identity.Features;

/// <summary>
/// v2.1 — system user management (admin only): list, create, activate/deactivate,
/// reset password. Business rules live in <see cref="UserAdminRules"/> (pure, unit-tested).
/// </summary>
public static class UserAdminEndpoints
{
    public sealed record UserAdminDto(Guid Id, string Username, string DisplayName, string Role, Guid? BranchId, bool IsActive, DateTime CreatedAtUtc);

    public sealed record CreateUserRequest(string Username, string Password, string DisplayName, string Role, Guid? BranchId, bool IsActive = true);

    public sealed record SetStatusRequest(bool IsActive);

    public sealed record ResetPasswordRequest(string NewPassword);

    public static void Map(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/identity/users").WithTags("Identity — Users");

        group.MapGet("", async (IdentityDbContext db, string? search, CancellationToken cancellationToken) =>
            {
                var query = db.Users.AsNoTracking().AsQueryable();
                var term = search?.Trim().ToLowerInvariant();
                if (!string.IsNullOrEmpty(term))
                {
                    query = query.Where(u => u.Username.ToLower().Contains(term) || u.DisplayName.ToLower().Contains(term));
                }

                var users = await query
                    .OrderBy(u => u.Username)
                    .ToListAsync(cancellationToken);
                return Results.Ok(users.Select(u => u.ToAdminDto()).ToList());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("All operator accounts, optionally filtered by a username/display-name search term.");

        group.MapPost("", async (
                CreateUserRequest request,
                IdentityDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var errors = new Dictionary<string, string[]>();

                var username = UserAdminRules.NormalizeUsername(request.Username ?? string.Empty);
                if (!UserAdminRules.IsValidUsername(username))
                {
                    errors["username"] = [$"Must be {UserAdminRules.UsernameMinLength}-{UserAdminRules.UsernameMaxLength} characters; lowercase letters, digits, dot, dash, underscore only."];
                }
                if (request.Password is null || !UserAdminRules.IsValidPassword(request.Password))
                {
                    errors["password"] = [$"Must be {UserAdminRules.PasswordMinLength}-{UserAdminRules.PasswordMaxLength} characters."];
                }
                if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Trim().Length > UserAdminRules.DisplayNameMaxLength)
                {
                    errors["displayName"] = ["Required, max 128 characters."];
                }
                if (!UserAdminRules.IsValidRole(request.Role ?? string.Empty))
                {
                    errors["role"] = ["Must be one of: admin, reception, buffet, coach."];
                }
                if (request.BranchId is { } branchId && !await branches.ExistsAsync(branchId, cancellationToken))
                {
                    errors["branchId"] = ["Unknown or inactive branch."];
                }

                if (errors.Count == 0
                    && await db.Users.AnyAsync(u => u.Username == username, cancellationToken))
                {
                    throw new GmsException(
                        ErrorCodes.IdentityDuplicateUsername,
                        "This username is already taken.",
                        statusCode: 409);
                }

                if (errors.Count > 0)
                {
                    throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
                }

                var user = new AppUser
                {
                    Username = username,
                    PasswordHash = PasswordHasher.Hash(request.Password),
                    DisplayName = request.DisplayName.Trim(),
                    Role = request.Role,
                    BranchId = request.BranchId,
                    IsActive = request.IsActive,
                };
                db.Users.Add(user);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Created($"/api/v1/identity/users/{user.Id}", user.ToAdminDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Create an operator account (admin).");

        group.MapPost("/{id:guid}/status", async (
                Guid id,
                SetStatusRequest request,
                ClaimsPrincipal principal,
                IdentityDbContext db,
                CancellationToken cancellationToken) =>
            {
                if (!Guid.TryParse(
                        principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub"),
                        out var currentUserId))
                {
                    throw new GmsException(ErrorCodes.IdentityInvalidCredentials, "Invalid token subject.", 401);
                }

                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
                if (user is null)
                {
                    throw new GmsException(ErrorCodes.IdentityUserNotFound, "User not found.", 404);
                }

                if (!request.IsActive)
                {
                    var allUsers = await db.Users.ToListAsync(cancellationToken);
                    var rejection = UserAdminRules.CheckDeactivate(currentUserId, user, allUsers);
                    if (rejection is not null)
                    {
                        throw new GmsException(rejection, "This deactivation is not allowed.", statusCode: 409);
                    }
                }

                user.IsActive = request.IsActive;
                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(user.ToAdminDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Activate or deactivate an operator account (self/last-admin deactivation guarded).");

        group.MapPost("/{id:guid}/password", async (
                Guid id,
                ResetPasswordRequest request,
                IdentityDbContext db,
                CancellationToken cancellationToken) =>
            {
                if (request.NewPassword is null || !UserAdminRules.IsValidPassword(request.NewPassword))
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "One or more validation errors occurred.",
                        400,
                        new Dictionary<string, string[]> { ["newPassword"] = [$"Must be {UserAdminRules.PasswordMinLength}-{UserAdminRules.PasswordMaxLength} characters."] });
                }

                var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
                if (user is null)
                {
                    throw new GmsException(ErrorCodes.IdentityUserNotFound, "User not found.", 404);
                }

                user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(user.ToAdminDto());
            })
            .RequireAuthorization(Policies.Admin)
            .WithSummary("Reset an operator's password (admin).");
    }
}
