using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Gms.BuildingBlocks;

namespace Gms.Api.Infrastructure.Auditing;

/// <summary>
/// Phase 9 hardening: records every mutating API request (POST / PUT / PATCH / DELETE under
/// /api) into the audit database. Audit failures are logged and swallowed — the trail must
/// never take the API down, and it must never alter a response.
/// </summary>
public sealed class AuditMiddleware(RequestDelegate next, ILogger<AuditMiddleware> logger)
{
    private static readonly HashSet<string> AuditedMethods = new(StringComparer.OrdinalIgnoreCase)
    {
        HttpMethods.Post, HttpMethods.Put, HttpMethods.Patch, HttpMethods.Delete,
    };

    private const long MaxCapturedBodyBytes = 64 * 1024;
    private const int MaxStoredBodyChars = 4000;

    public async Task InvokeAsync(HttpContext context)
    {
        if (!AuditedMethods.Contains(context.Request.Method) ||
            !context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();
        string? body = await TryCaptureBodyAsync(context.Request);
        Exception? failure = null;

        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            failure = exception;
            throw;
        }
        finally
        {
            stopwatch.Stop();
            await WriteAuditAsync(context, stopwatch.ElapsedMilliseconds, body, failure);
        }
    }

    private async Task WriteAuditAsync(HttpContext context, long elapsedMs, string? body, Exception? failure)
    {
        try
        {
            var user = context.User;

            // While an exception is still in flight the response status is not final yet —
            // derive it from the exception itself (GmsException carries its status code).
            var statusCode = failure switch
            {
                GmsException gmsException => gmsException.StatusCode,
                not null => StatusCodes.Status500InternalServerError,
                null => context.Response.StatusCode,
            };

            var record = new AuditRecord
            {
                OccurredAtUtc = DateTime.UtcNow,
                UserId = Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
                    ? userId
                    : null,
                Username = user.Identity?.IsAuthenticated == true
                    ? user.FindFirstValue(ClaimTypes.Name)
                    : null,
                Role = user.FindFirstValue(ClaimTypes.Role),
                BranchId = Guid.TryParse(user.FindFirstValue("branchId"), out var branchId) ? branchId : null,
                Action = context.Request.Method,
                Path = context.Request.Path.ToString(),
                StatusCode = statusCode,
                DurationMs = elapsedMs,
                RemoteIp = context.Connection.RemoteIpAddress?.ToString(),
                Body = body,
            };

            var db = context.RequestServices.GetRequiredService<AuditDbContext>();
            db.AuditRecords.Add(record);
            await db.SaveChangesAsync(context.RequestAborted);
        }
        catch (Exception auditFailure)
        {
            logger.LogWarning(auditFailure, "Audit write failed for {Method} {Path}",
                context.Request.Method, context.Request.Path);
        }
    }

    /// <summary>
    /// Buffers and captures a JSON request body (size-capped) with passwords redacted, then
    /// rewinds the stream so the endpoint reads it untouched. Non-JSON or unparseable bodies
    /// are not stored.
    /// </summary>
    private static async Task<string?> TryCaptureBodyAsync(HttpRequest request)
    {
        try
        {
            var contentType = request.ContentType;
            if (contentType is null ||
                !contentType.StartsWith("application/json", StringComparison.OrdinalIgnoreCase) ||
                request.ContentLength is null or 0 ||
                request.ContentLength > MaxCapturedBodyBytes)
            {
                return null;
            }

            request.EnableBuffering();
            using var reader = new StreamReader(
                request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false,
                bufferSize: 1024, leaveOpen: true);
            var content = await reader.ReadToEndAsync();
            request.Body.Position = 0;

            content = content.Trim();
            if (content.Length == 0)
            {
                return null;
            }

            return Redact(content);
        }
        catch
        {
            // Body capture is best-effort: never let auditing break the request pipeline.
            try
            {
                request.Body.Position = 0;
            }
            catch
            {
                // stream state unknown — the endpoint will cope
            }

            return null;
        }
    }

    private static string? Redact(string json)
    {
        try
        {
            var node = JsonNode.Parse(json);
            if (node is null)
            {
                return null;
            }

            RedactNode(node);

            var serialized = node.ToJsonString();
            return serialized.Length <= MaxStoredBodyChars
                ? serialized
                : serialized[..MaxStoredBodyChars];
        }
        catch (JsonException)
        {
            return null; // truncated/invalid JSON — the request is still audited, just without the body
        }
    }

    private static void RedactNode(JsonNode node)
    {
        if (node is JsonObject obj)
        {
            foreach (var property in obj.ToList())
            {
                if (property.Key is "password" or "Password" or "newPassword" or "confirmPassword")
                {
                    obj[property.Key] = "***";
                }
                else if (property.Value is not null)
                {
                    RedactNode(property.Value);
                }
            }
        }
        else if (node is JsonArray array)
        {
            foreach (var item in array)
            {
                if (item is not null)
                {
                    RedactNode(item);
                }
            }
        }
    }
}
