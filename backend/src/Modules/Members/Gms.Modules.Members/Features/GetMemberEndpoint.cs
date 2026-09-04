using Gms.BuildingBlocks;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Features;

/// <summary>GET /api/v1/members/{id} — member profile (any staff role).</summary>
public static class GetMemberEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapGet("/api/v1/members/{id:guid}", async (
                Guid id,
                MembersDbContext db,
                CancellationToken cancellationToken) =>
            {
                var member = await db.Members.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
                return member is null
                    ? throw new GmsException(ErrorCodes.MemberNotFound, "Member not found.", 404)
                    : Results.Ok(member.ToPublicDto());
            })
            .RequireAuthorization(Policies.Staff)
            .WithTags("Members")
            .WithSummary("Member by id.");
    }
}
