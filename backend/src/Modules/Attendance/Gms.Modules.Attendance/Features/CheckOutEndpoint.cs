using Gms.BuildingBlocks;
using Gms.Modules.Attendance.Infrastructure;
using Gms.Modules.Branches.Public;
using Gms.Modules.Catalog.Public;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales.Public;
using Microsoft.EntityFrameworkCore;

namespace Gms.Modules.Attendance.Features;

/// <summary>POST /api/v1/attendance/entries/{id}/check-out — close an open visit (admin, reception).</summary>
public static class CheckOutEndpoint
{
    public static void Map(IEndpointRouteBuilder app)
    {
        app.MapPost("/api/v1/attendance/entries/{id}/check-out", async (
                Guid id,
                AttendanceDbContext db,
                IMembersModule members,
                ICatalogModule catalog,
                IBranchesModule branches,
                ISalesModule sales,
                CancellationToken cancellationToken) =>
            {
                var entry = await db.AttendanceEntries
                    .FirstOrDefaultAsync(e => e.Id == id, cancellationToken)
                    ?? throw new GmsException(ErrorCodes.AttendanceEntryNotFound, "Attendance entry not found.", 404);

                if (entry.CheckOutAtUtc is not null)
                {
                    throw new GmsException(
                        ErrorCodes.AttendanceAlreadyCheckedOut,
                        "This visit is already closed.",
                        409);
                }

                entry.CheckOutAtUtc = DateTime.UtcNow;
                entry.UpdatedAtUtc = entry.CheckOutAtUtc;
                await db.SaveChangesAsync(cancellationToken);

                var lookup = await AttendanceViews.LoadLookupAsync(
                    members, catalog, branches, sales, [entry.MemberId], [entry.MemberPackageId], cancellationToken);
                var view = entry.ToView(lookup, DateTime.UtcNow);

                return Results.Ok(view);
            })
            .RequireAuthorization(Policies.Management)
            .WithTags("Attendance")
            .WithSummary("Check out an open visit (closes the presence-board row).");
    }
}
