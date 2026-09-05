using Gms.Modules.Members.Features;
using Gms.Modules.Members.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Members;

public static class MembersModule
{
    /// <summary>Registers the Members module. Call once from the API host.</summary>
    public static IServiceCollection AddMembersModule(this IServiceCollection services, string connectionString)
    {
        services.AddDbContext<MembersDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<Public.IMembersModule, MembersModuleApi>();
        return services;
    }

    public static IEndpointRouteBuilder MapMembersEndpoints(this IEndpointRouteBuilder app)
    {
        CreateMemberEndpoint.Map(app);
        SearchMembersEndpoint.Map(app);
        GetMemberEndpoint.Map(app);
        UpdateMemberEndpoint.Map(app);
        SetMemberStatusEndpoint.Map(app);
        return app;
    }
}

/// <summary>Internal implementation of the public contract (used by Sales/Attendance/Coaching/Buffet/Wallet).</summary>
internal sealed class MembersModuleApi(MembersDbContext db) : Public.IMembersModule
{
    public async Task<Public.MemberPublicDto?> GetAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var member = await db.Members.AsNoTracking().FirstOrDefaultAsync(m => m.Id == memberId, cancellationToken);
        return member?.ToPublicDto();
    }

    public async Task<Public.MemberPublicDto?> GetByCardCodeAsync(string cardCode, CancellationToken cancellationToken = default)
    {
        var member = await db.Members.AsNoTracking()
            .FirstOrDefaultAsync(m => m.CardCode == cardCode, cancellationToken);
        return member?.ToPublicDto();
    }

    public async Task<bool> IsActiveAsync(Guid memberId, CancellationToken cancellationToken = default) =>
        await db.Members.AsNoTracking()
            .AnyAsync(m => m.Id == memberId && m.Status == Domain.MemberStatus.Active, cancellationToken);

    public async Task<IReadOnlyList<Public.MemberPublicDto>> GetBatchAsync(
        IReadOnlyCollection<Guid> memberIds, CancellationToken cancellationToken = default)
    {
        if (memberIds.Count == 0)
        {
            return [];
        }

        var members = await db.Members.AsNoTracking()
            .Where(m => memberIds.Contains(m.Id))
            .ToListAsync(cancellationToken);
        return members.Select(m => m.ToPublicDto()).ToList();
    }

    public async Task<IReadOnlyList<Guid>> FindIdsAsync(string searchTerm, int limit = 50, CancellationToken cancellationToken = default)
    {
        var term = searchTerm.Trim();
        if (term.Length == 0)
        {
            return [];
        }

        return await db.Members.AsNoTracking()
            .Where(m =>
                m.FullName.Contains(term) ||
                m.Code.Contains(term) ||
                (m.PhoneNumber != null && m.PhoneNumber.Contains(term)) ||
                (m.CardCode != null && m.CardCode.Contains(term)))
            .OrderBy(m => m.Code)
            .Take(limit)
            .Select(m => m.Id)
            .ToListAsync(cancellationToken);
    }
}
