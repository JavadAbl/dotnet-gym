using Gms.BuildingBlocks;
using Gms.Modules.Members.Domain;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Features;

/// <summary>
/// GET /api/v1/members — paged search. Query: search, status, branchId, page, pageSize.
/// Envelope: PagedResult&lt;MemberPublicDto&gt;.
/// </summary>
public static class SearchMembersEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/members", async (
                MembersDbContext db,
                string? search,
                string? status,
                Guid? branchId,
                int page,
                int pageSize,
                CancellationToken cancellationToken) =>
            {
                page = page <= 0 ? 1 : page;
                pageSize = pageSize <= 0 ? 20 : Math.Min(pageSize, 100);

                MemberStatus? statusFilter = null;
                if (!string.IsNullOrWhiteSpace(status))
                {
                    if (!Enum.TryParse<MemberStatus>(status.Trim(), ignoreCase: true, out var parsed))
                    {
                        throw new GmsException(
                            ErrorCodes.ValidationFailed,
                            "Invalid status filter.",
                            400,
                            new Dictionary<string, string[]> { ["status"] = ["Valid values: Active, Inactive, Blocked."] });
                    }
                    statusFilter = parsed;
                }

                var query = db.Members.AsNoTracking().AsQueryable();

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.Trim();
                    query = query.Where(m =>
                        m.FullName.Contains(term) ||
                        m.Code.Contains(term) ||
                        (m.PhoneNumber != null && m.PhoneNumber.Contains(term)) ||
                        (m.CardCode != null && m.CardCode.Contains(term)));
                }

                if (statusFilter is { } st)
                {
                    query = query.Where(m => m.Status == st);
                }

                if (branchId is { } branch)
                {
                    query = query.Where(m => m.HomeBranchId == branch);
                }

                var totalCount = await query.CountAsync(cancellationToken);

                var items = await query
                    .OrderByDescending(m => m.CreatedAtUtc)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync(cancellationToken);

                return Results.Ok(new PagedResult<MemberPublicDto>(
                    items.Select(m => m.ToPublicDto()).ToList(),
                    page,
                    pageSize,
                    totalCount));
            })
            .RequireAuthorization(Policies.Staff)
            .WithTags("Members")
            .WithSummary("Paged member search (name / code / phone / card).");
    }
}
