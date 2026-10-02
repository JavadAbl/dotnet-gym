using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.Attendance;

public static class AttendanceModule
{
    /// <summary>Wired when the Attendance module phase starts.</summary>
    public static IServiceCollection AddAttendanceModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapAttendanceModuleEndpoints(this IEndpointRouteBuilder app) => app;
}
