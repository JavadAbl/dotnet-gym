using Gms.BuildingBlocks;
using Microsoft.EntityFrameworkCore;

namespace Gms.Api.Infrastructure.Auditing;

/// <summary>GET /api/v1/audit — paged audit trail for administrators (Phase 9 hardening).</summary>
internal static class AuditEndpoint
{
    public sealed record AuditView(
        long Id,
        DateTime OccurredAtUtc,
        Guid? UserId,
        string? Username,
        string? Role,
        Guid? BranchId,
        string Action,
        string Path,
        int StatusCode,
        long DurationMs,
        string? RemoteIp,
        string? Body);

    public static IEndpointRouteBuilder MapAuditEndpoint(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/audit", async (
                AuditDbContext db,
                int? page,
                int? pageSize,
                string? action,
                Guid? userId,
                CancellationToken cancellationToken) =>
            {
                var currentPage = Math.Max(1, page ?? 1);
                var currentPageSize = Math.Clamp(pageSize ?? 20, 1, 100);

                var query = db.AuditRecords.AsNoTracking().AsQueryable();

                if (!string.IsNullOrWhiteSpace(action))
                {
                    var normalized = action.Trim().ToUpperInvariant();
                    query = query.Where(r => r.Action == normalized);
                }

                if (userId is { } userIdFilter)
                {
                    query = query.Where(r => r.UserId == userIdFilter);
                }

                var totalCount = await query.CountAsync(cancellationToken);
                var rows = await query
                    .OrderByDescending(r => r.OccurredAtUtc)
                    .ThenByDescending(r => r.Id)
                    .Skip((currentPage - 1) * currentPageSize)
                    .Take(currentPageSize)
                    .ToListAsync(cancellationToken);

                // Client-side mapping — keeps the query translatable regardless of provider quirks.
                var items = rows.Select(r => new AuditView(
                    r.Id,
                    r.OccurredAtUtc,
                    r.UserId,
                    r.Username,
                    r.Role,
                    r.BranchId,
                    r.Action,
                    r.Path,
                    r.StatusCode,
                    r.DurationMs,
                    r.RemoteIp,
                    r.Body)).ToList();

                return Results.Ok(new PagedResult<AuditView>(items, currentPage, currentPageSize, totalCount));
            })
            .RequireAuthorization(Policies.Admin)
            .WithTags("Audit")
            .WithSummary("Paged audit trail of mutating API requests (admin only).");

        return app;
    }
}
