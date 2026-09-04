using Gms.BuildingBlocks;
using Gms.Modules.Members.Domain;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Features;

/// <summary>
/// POST /api/v1/members/{id}/status — activate / deactivate / block.
/// Blocking never touches purchased packages (those live in the Sales module, Phase 3);
/// it only prevents future check-ins.
/// </summary>
public static class SetMemberStatusEndpoint
{
    public sealed record SetMemberStatusRequest(string Status);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/members/{id:guid}/status", async (
                Guid id,
                SetMemberStatusRequest request,
                MembersDbContext db,
                CancellationToken cancellationToken) =>
            {
                if (!Enum.TryParse<MemberStatus>(request.Status.Trim(), ignoreCase: true, out var status))
                {
                    throw new GmsException(
                        ErrorCodes.ValidationFailed,
                        "Invalid status value.",
                        400,
                        new Dictionary<string, string[]> { ["status"] = ["Valid values: Active, Inactive, Blocked."] });
                }

                var member = await db.Members.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
                if (member is null)
                {
                    throw new GmsException(ErrorCodes.MemberNotFound, "Member not found.", 404);
                }

                member.Status = status;
                member.UpdatedAtUtc = DateTime.UtcNow;
                await db.SaveChangesAsync(cancellationToken);

                return Results.Ok(member.ToPublicDto());
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Members")
            .WithSummary("Set member status (Active / Inactive / Blocked).");
    }
}
