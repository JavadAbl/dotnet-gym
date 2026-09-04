using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Features;

/// <summary>PUT /api/v1/members/{id} — update profile fields (status is changed via the dedicated endpoint).</summary>
public static class UpdateMemberEndpoint
{
    public sealed record UpdateMemberRequest(
        string FullName,
        string? PhoneNumber,
        string? Gender,
        System.DateTime? BirthDate,
        Guid HomeBranchId,
        string? CardCode,
        string? Notes);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPut("/api/v1/members/{id:guid}", async (
                Guid id,
                UpdateMemberRequest request,
                MembersDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var member = await db.Members.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
                if (member is null)
                {
                    throw new GmsException(ErrorCodes.MemberNotFound, "Member not found.", 404);
                }

                var errors = await MemberValidation.ValidateAsync(
                    db, branches,
                    request.FullName, request.PhoneNumber, request.CardCode,
                    request.HomeBranchId,
                    excludeMemberId: id,
                    cancellationToken);
                MemberValidation.ThrowIfInvalid(errors);

                if (request.BirthDate is { } birth && birth > DateTime.UtcNow)
                {
                    errors["birthDate"] = ["Birth date cannot be in the future."];
                    MemberValidation.ThrowIfInvalid(errors);
                }

                member.FullName = request.FullName.Trim();
                member.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
                member.Gender = CreateMemberEndpoint.ParseGender(request.Gender);
                member.BirthDateUtc = request.BirthDate;
                member.HomeBranchId = request.HomeBranchId;
                member.CardCode = string.IsNullOrWhiteSpace(request.CardCode) ? null : request.CardCode.Trim();
                member.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
                member.UpdatedAtUtc = DateTime.UtcNow;

                await db.SaveChangesAsync(cancellationToken);
                return Results.Ok(member.ToPublicDto());
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Members")
            .WithSummary("Update member profile.");
    }
}
