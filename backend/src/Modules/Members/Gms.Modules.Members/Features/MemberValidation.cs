using System.Text.RegularExpressions;
using Gms.BuildingBlocks;
using Gms.Modules.Branches.Public;
using Gms.Modules.Members.Domain;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members.Features;

/// <summary>Shared validation + duplicate guards for member write operations.</summary>
internal static class MemberValidation
{
    private static readonly Regex PhoneRegex = new(
        @"^09\d{9}$|^\+?\d{7,15}$",
        RegexOptions.Compiled,
        matchTimeout: TimeSpan.FromMilliseconds(200));

    public static async Task<Dictionary<string, string[]>> ValidateAsync(
        MembersDbContext db,
        IBranchesModule branches,
        string? fullName,
        string? phoneNumber,
        string? cardCode,
        Guid homeBranchId,
        Guid? excludeMemberId,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(fullName) || fullName.Trim().Length > 200)
        {
            errors["fullName"] = ["Required, max 200 characters."];
        }

        if (!string.IsNullOrWhiteSpace(phoneNumber))
        {
            var phone = phoneNumber.Trim();
            if (phone.Length is < 7 or > 20 || !PhoneRegex.IsMatch(phone))
            {
                errors["phoneNumber"] = ["Invalid phone number. Use formats like 09121234567 or +9821..."];
            }
            else if (await db.Members.AsNoTracking()
                .AnyAsync(m => m.PhoneNumber == phone && (excludeMemberId == null || m.Id != excludeMemberId), cancellationToken))
            {
                errors["phoneNumber"] = [$"Phone number {phone} is already registered to another member."];
            }
        }

        if (!string.IsNullOrWhiteSpace(cardCode))
        {
            var card = cardCode.Trim();
            if (card.Length > 64)
            {
                errors["cardCode"] = ["Max 64 characters."];
            }
            else if (await db.Members.AsNoTracking()
                .AnyAsync(m => m.CardCode == card && (excludeMemberId == null || m.Id != excludeMemberId), cancellationToken))
            {
                errors["cardCode"] = [$"Card {card} is already assigned to another member."];
            }
        }

        if (homeBranchId == Guid.Empty || !await branches.ExistsAsync(homeBranchId, cancellationToken))
        {
            errors["homeBranchId"] = ["Unknown or inactive branch."];
        }

        return errors;
    }

    public static void ThrowIfInvalid(IReadOnlyDictionary<string, string[]> errors)
    {
        if (errors.Count > 0)
        {
            throw new GmsException(ErrorCodes.ValidationFailed, "One or more validation errors occurred.", 400, errors);
        }
    }

    public static async Task<string> GenerateNextMemberCodeAsync(MembersDbContext db, CancellationToken cancellationToken)
    {
        var codes = await db.Members.AsNoTracking().Select(m => m.Code).ToListAsync(cancellationToken);
        var max = codes.Count == 0
            ? 0
            : codes.Max(c => int.TryParse(c.StartsWith("M-", StringComparison.Ordinal) ? c[2..] : "", out var n) ? n : 0);
        return $"M-{(max + 1):D5}";
    }
}
