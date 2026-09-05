using Gms.Api.Extensions;
using Gms.BuildingBlocks;
using Gms.BuildingBlocks.Data;
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

app.MapIdentityEndpoints();
app.MapBranchEndpoints();
app.MapCatalogEndpoints();
app.MapMembersEndpoints();
app.MapWalletEndpoints();
app.MapSalesEndpoints();
app.MapAttendanceEndpoints();
app.MapCoachingEndpoints();
app.MapBuffetEndpoints();

// ---------------------------------------------------------------- boot: WAL + EnsureCreated + seeds (Phase 1 order)
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
});

app.MapGet("/api/v1/health", () => Results.Ok(new { status = "ok", utc = DateTime.UtcNow }))
    .AllowAnonymous();

app.Run();
