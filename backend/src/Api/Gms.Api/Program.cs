using System.Globalization;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Gms.Api.Extensions;
using Gms.Api.Infrastructure.Auditing;
using Gms.BuildingBlocks;
using Gms.Modules.Attendance;
using Gms.Modules.Branches;
using Gms.Modules.Branches.Public;
using Gms.Modules.Buffet;
using Gms.Modules.Catalog;
using Gms.Modules.Coaching;
using Gms.Modules.Identity;
using Gms.Modules.Identity.Public;
using Gms.Modules.Members;
using Gms.Modules.Members.Public;
using Gms.Modules.Sales;
using Gms.Modules.Wallet;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- connection strings (one SQLite file per module)
var identityCs = builder.Configuration.GetConnectionString("Identity") ?? "Data Source=data/gms-identity.db";
var branchesCs = builder.Configuration.GetConnectionString("Branches") ?? "Data Source=data/gms-branches.db";
var catalogCs = builder.Configuration.GetConnectionString("Catalog") ?? "Data Source=data/gms-catalog.db";
var membersCs = builder.Configuration.GetConnectionString("Members") ?? "Data Source=data/gms-members.db";
var salesCs = builder.Configuration.GetConnectionString("Sales") ?? "Data Source=data/gms-sales.db";
var walletCs = builder.Configuration.GetConnectionString("Wallet") ?? "Data Source=data/gms-wallet.db";
var attendanceCs = builder.Configuration.GetConnectionString("Attendance") ?? "Data Source=data/gms-attendance.db";
var coachingCs = builder.Configuration.GetConnectionString("Coaching") ?? "Data Source=data/gms-coaching.db";
var buffetCs = builder.Configuration.GetConnectionString("Buffet") ?? "Data Source=data/gms-buffet.db";
var auditCs = builder.Configuration.GetConnectionString("Audit") ?? "Data Source=data/gms-audit.db";

Directory.CreateDirectory("data");

// ---------------------------------------------------------------- error handling: ProblemDetails + errorCode
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GmsExceptionHandler>();

// ---------------------------------------------------------------- auth (JWT carries sub / role / branchId)
var jwtSection = builder.Configuration.GetSection("Jwt");
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
    jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is not configured.")));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidateAudience = true,
            ValidAudience = jwtSection["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Policies.Admin, p => p.RequireRole(UserRoles.Admin));
    options.AddPolicy(Policies.Management, p => p.RequireRole(UserRoles.Admin, UserRoles.Reception));
    options.AddPolicy(Policies.Staff, p => p.RequireAuthenticatedUser());
    options.AddPolicy(Policies.Counter, p => p.RequireRole(UserRoles.Admin, UserRoles.Reception, UserRoles.Buffet));
});

// ---------------------------------------------------------------- rate limiting (Phase 9 hardening)
// Global token bucket per user/IP keeps any single client from starving the shared SQLite writers;
// a strict per-IP fixed window guards the login endpoint against brute force. Limits are
// ops-tunable via the RateLimiting section (see appsettings.json + deployment docs).
var rateLimits = builder.Configuration.GetSection("RateLimiting");
int RateLimitValue(string key, int fallback) => rateLimits.GetValue<int?>(key) ?? fallback;
var globalTokenLimit = RateLimitValue("GlobalTokenLimit", 200);
var globalTokensPerPeriod = RateLimitValue("GlobalTokensPerPeriod", 100);
var globalReplenishSeconds = RateLimitValue("GlobalReplenishSeconds", 10);
var loginPermitLimit = RateLimitValue("LoginPermitLimit", 10);
var loginWindowSeconds = RateLimitValue("LoginWindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter =
                ((int)retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        }

        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = ErrorCodes.RateLimitExceeded,
            Detail = "Too many requests — slow down and retry shortly.",
            Instance = context.HttpContext.Request.Path,
        }, cancellationToken);
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var identity =
            httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";

        return RateLimitPartition.GetTokenBucketLimiter(identity, _ => new TokenBucketRateLimiterOptions
        {
            TokenLimit = globalTokenLimit,
            TokensPerPeriod = globalTokensPerPeriod,
            ReplenishmentPeriod = TimeSpan.FromSeconds(globalReplenishSeconds),
            QueueLimit = 0,
        });
    });

    options.AddPolicy(Policies.AuthLoginRateLimit, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPermitLimit,
                Window = TimeSpan.FromSeconds(loginWindowSeconds),
                QueueLimit = 0,
            }));
});

// ---------------------------------------------------------------- modules (modular monolith wiring)
builder.Services.AddIdentityModule(identityCs);
builder.Services.AddBranchesModule(branchesCs);
builder.Services.AddCatalogModule(catalogCs);
builder.Services.AddMembersModule(membersCs);
builder.Services.AddWalletModule(walletCs);
builder.Services.AddSalesModule(salesCs);
builder.Services.AddAttendanceModule(attendanceCs);
builder.Services.AddCoachingModule(coachingCs);
builder.Services.AddBuffetModule(buffetCs);

// ---------------------------------------------------------------- audit trail (Phase 9 hardening, own SQLite file)
builder.Services.AddDbContext<AuditDbContext>(options => options.UseSqlite(auditCs));

// ---------------------------------------------------------------- swagger + cors (dev convenience)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "GMS API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the JWT from /api/v1/identity/login.",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        },
    });
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

// ---------------------------------------------------------------- pipeline
app.UseExceptionHandler();
app.UseSwagger();
app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "GMS API v1"));
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<AuditMiddleware>();

app.MapIdentityEndpoints();
app.MapBranchEndpoints();
app.MapCatalogEndpoints();
app.MapMembersEndpoints();
app.MapWalletEndpoints();
app.MapSalesEndpoints();
app.MapAttendanceEndpoints();
app.MapCoachingEndpoints();
app.MapBuffetEndpoints();
app.MapAuditEndpoint();

// ---------------------------------------------------------------- boot: WAL + migrations (baselining legacy
// EnsureCreated databases) + seeds (Phase 1 order)
await Bootstrapper.InitializeDatabasesAsync(app.Services, new Dictionary<string, string>
{
    ["Identity"] = identityCs,
    ["Branches"] = branchesCs,
    ["Catalog"] = catalogCs,
    ["Members"] = membersCs,
    ["Wallet"] = walletCs,
    ["Sales"] = salesCs,
    ["Attendance"] = attendanceCs,
    ["Coaching"] = coachingCs,
    ["Buffet"] = buffetCs,
    ["Audit"] = auditCs,
});

app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }))
    .AllowAnonymous();

app.Run();
