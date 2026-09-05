using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Domain;
using Gms.Modules.Members.Infrastructure;

namespace Gms.Modules.Members.Features;

/// <summary>POST /api/v1/members — register a new member (admin, reception).</summary>
public static class CreateMemberEndpoint
{
    public sealed record CreateMemberRequest(
        string FullName,
        string? PhoneNumber,
        string? Gender,
        DateTime? BirthDate,
        Guid HomeBranchId,
        string? CardCode,
        string? Notes);

    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/members", async (
                CreateMemberRequest request,
                MembersDbContext db,
                IBranchesModule branches,
                CancellationToken cancellationToken) =>
            {
                var errors = await MemberValidation.ValidateAsync(
                    db, branches,
                    request.FullName, request.PhoneNumber, request.CardCode,
                    request.HomeBranchId,
                    excludeMemberId: null,
                    cancellationToken);
                MemberValidation.ThrowIfInvalid(errors);

                if (request.BirthDate is { } birth && birth > DateTime.UtcNow)
                {
                    errors["birthDate"] = ["Birth date cannot be in the future."];
                    MemberValidation.ThrowIfInvalid(errors);
                }

                var member = new Member
                {
                    Code = await MemberValidation.GenerateNextMemberCodeAsync(db, cancellationToken),
                    FullName = request.FullName.Trim(),
                    PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim(),
                    Gender = ParseGender(request.Gender),
                    BirthDateUtc = request.BirthDate,
                    JoinDateUtc = DateTime.UtcNow,
                    HomeBranchId = request.HomeBranchId,
                    CardCode = string.IsNullOrWhiteSpace(request.CardCode) ? null : request.CardCode.Trim(),
                    Status = MemberStatus.Active,
                    Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
                };

                db.Members.Add(member);
                await db.SaveChangesAsync(cancellationToken);

                return Results.Created($"/api/v1/members/{member.Id}", member.ToPublicDto());
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Members")
            .WithSummary("Register a new member.");
    }

    internal static Gender ParseGender(string? gender) => (gender?.Trim().ToLowerInvariant()) switch
    {
        "male" or "m" or "مرد" or "آقا" => Gender.Male,
        "female" or "f" or "زن" or "بانو" => Gender.Female,
        _ => Gender.Unknown,
    };
}
