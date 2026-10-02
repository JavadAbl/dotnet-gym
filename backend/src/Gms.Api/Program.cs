using System.Text;
using Gms.Api.Infrastructure;
using Gms.BuildingBlocks;
using Gms.BuildingBlocks.Events;
using Gms.Modules.Attendance;
using Gms.Modules.Buffet;
using Gms.Modules.Branches;
using Gms.Modules.Catalog;
using Gms.Modules.Coaching;
using Gms.Modules.Identity;
using Gms.Modules.Identity.Application;
using Gms.Modules.Members;
using Gms.Modules.Sales;
using Gms.Modules.Wallet;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, configuration) =>
        configuration.ReadFrom.Configuration(context.Configuration));

    var jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
                     ?? throw new InvalidOperationException("Missing 'Jwt' configuration section.");

    var dbPath = Path.GetFullPath(Path.Combine(
        builder.Environment.ContentRootPath,
        builder.Configuration["Database:Path"] ?? "gms.db"));
    var connectionString = $"Data Source={dbPath};Foreign Keys=True";

    // Modules
    builder.Services.AddBuildingBlocks();
    builder.Services.AddIdentityModule(connectionString, jwtOptions);
    builder.Services.AddBranchesModule(connectionString);
    builder.Services.AddMembersModule();
    builder.Services.AddCatalogModule();
    builder.Services.AddSalesModule();
    builder.Services.AddAttendanceModule();
    builder.Services.AddCoachingModule();
    builder.Services.AddBuffetModule();
    builder.Services.AddWalletModule();

    // Authentication (JWT bearer, culture-neutral claims)
    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidIssuer = jwtOptions.Issuer,
                ValidAudience = jwtOptions.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
                ValidateIssuerSigningKey = true,
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                NameClaimType = "name",
                RoleClaimType = "role",
            };
            options.Events = new JwtBearerEvents
            {
                OnChallenge = async context =>
                {
                    context.HandleResponse();
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        type = "https://gms.local/errors/auth-unauthenticated",
                        title = "AUTH_UNAUTHENTICATED",
                        status = 401,
                        errorCode = "AUTH_UNAUTHENTICATED",
                    });
                },
                OnForbidden = async context =>
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        type = "https://gms.local/errors/auth-forbidden",
                        title = "AUTH_FORBIDDEN",
                        status = 403,
                        errorCode = "AUTH_FORBIDDEN",
                    });
                },
            };
        });

    builder.Services.AddAuthorizationBuilder()
        .AddPolicy("Admin", p => p.RequireRole("Admin"))
        .AddPolicy("Reception", p => p.RequireRole("Reception"))
        .AddPolicy("Buffet", p => p.RequireRole("Buffet"))
        .AddPolicy("Coach", p => p.RequireRole("Coach"));

    // OpenAPI / Swagger
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
            Description = "Paste the access token returned by /api/v1/auth/login.",
        });
        options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecuritySchemeReference("Bearer"),
                new List<string>()
            },
        });
    });

    // Errors: ProblemDetails + machine-readable errorCode (culture-neutral)
    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<GmsExceptionHandler>();
    builder.Services.AddHealthChecks();

    var app = builder.Build();

    app.UseSerilogRequestLogging();
    app.UseExceptionHandler();
    app.UseStatusCodePages();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseAuthentication();
    app.UseAuthorization();

    app.MapHealthChecks("/health");
    app.MapIdentityModuleEndpoints();
    app.MapBranchesModuleEndpoints();
    app.MapMembersModuleEndpoints();
    app.MapCatalogModuleEndpoints();
    app.MapSalesModuleEndpoints();
    app.MapAttendanceModuleEndpoints();
    app.MapCoachingModuleEndpoints();
    app.MapBuffetModuleEndpoints();
    app.MapWalletModuleEndpoints();

    // Apply per-module migrations + seed (skipped during `dotnet ef` design time).
    if (!EF.IsDesignTime)
    {
        await DatabaseInitializer.RunAsync(app.Services, connectionString);
    }

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "GMS API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program;
