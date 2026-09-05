namespace Gms.Api.Infrastructure.Auditing;

/// <summary>
/// One append-only audit row (Phase 9 hardening). Captures every mutating API request:
/// who (JWT sub / role / branch), what (method + path + redacted JSON body), the outcome
/// (status code) and the cost (duration). Read-only traffic is intentionally not audited —
/// the trail exists to answer "who changed what, when, from where".
/// </summary>
public class AuditRecord
{
    /// <summary>Auto-increment keeps the append-only log compact and chronologically sortable.</summary>
    public long Id { get; set; }

    public DateTime OccurredAtUtc { get; set; }

    /// <summary>JWT sub claim; null for anonymous calls (e.g. failed logins before authentication).</summary>
    public Guid? UserId { get; set; }

    /// <summary>Denormalized username (unique_name claim) — readable even if the user is ever removed.</summary>
    public string? Username { get; set; }

    public string? Role { get; set; }

    /// <summary>JWT branchId claim when the operator is branch-pinned.</summary>
    public Guid? BranchId { get; set; }

    /// <summary>HTTP method (POST / PUT / PATCH / DELETE).</summary>
    public string Action { get; set; } = default!;

    public string Path { get; set; } = default!;

    public int StatusCode { get; set; }

    public long DurationMs { get; set; }

    public string? RemoteIp { get; set; }

    /// <summary>Redacted JSON body snapshot (password fields stripped, size-capped). Null when not capturable.</summary>
    public string? Body { get; set; }
}
