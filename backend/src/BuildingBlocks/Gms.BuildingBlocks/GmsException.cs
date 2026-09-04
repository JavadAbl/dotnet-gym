namespace Gms.BuildingBlocks;

/// <summary>
/// The one exception type modules are allowed to throw.
/// Translated by the API host into RFC7807 ProblemDetails with a machine-readable <c>errorCode</c>.
/// </summary>
public class GmsException : Exception
{
    public string ErrorCode { get; }

    public int StatusCode { get; }

    /// <summary>Optional per-field validation errors (field → messages).</summary>
    public IReadOnlyDictionary<string, string[]>? Errors { get; }

    public GmsException(
        string errorCode,
        string message,
        int statusCode = 400,
        IReadOnlyDictionary<string, string[]>? errors = null)
        : base(message)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
        Errors = errors;
    }
}
