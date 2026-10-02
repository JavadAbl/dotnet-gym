"""Generate skeleton module files (Module.cs + Public contract) for the 7 not-yet-implemented GMS modules."""
MODULES = ["Members", "Catalog", "Sales", "Attendance", "Coaching", "Buffet", "Wallet"]

MODULE_TEMPLATE = '''using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Gms.Modules.{name};

public static class {name}Module
{{
    /// <summary>Wired when the {name} module phase starts.</summary>
    public static IServiceCollection Add{name}Module(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder Map{name}ModuleEndpoints(this IEndpointRouteBuilder app) => app;
}}
'''

PUBLIC_TEMPLATE = '''namespace Gms.Modules.{name}.Public;

/// <summary>
/// Contracts other modules may consume from the {name} module.
/// Populated when the {name} module phase starts.
/// </summary>
public interface I{name}ModuleApi
{{
}}
'''

BASE = "/home/z/my-project/backend/src/Modules"

for name in MODULES:
    module_path = f"{BASE}/{name}/{name}Module.cs"
    public_path = f"{BASE}/{name}/Public/I{name}ModuleApi.cs"
    with open(module_path, "w") as f:
        f.write(MODULE_TEMPLATE.format(name=name))
    with open(public_path, "w") as f:
        f.write(PUBLIC_TEMPLATE.format(name=name))
    print(f"generated {name}")

print("SKELETON MODULES DONE")
