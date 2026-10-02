namespace Gms.BuildingBlocks.Exceptions;

/// <summary>Carries an HTTP status + machine-readable errorCode; rendered as ProblemDetails by the host.</summary>
public sealed class GmsException : Exception
{
    public int StatusCode { get; }
    public string ErrorCode { get; }

    public GmsException(int statusCode, string errorCode, string message) : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }

    public static GmsException BadRequest(string code, string message) => new(400, code, message);
    public static GmsException Unauthorized(string code, string message) => new(401, code, message);
    public static GmsException Forbidden(string code, string message) => new(403, code, message);
    public static GmsException NotFound(string code, string message) => new(404, code, message);
    public static GmsException Conflict(string code, string message) => new(409, code, message);
}
