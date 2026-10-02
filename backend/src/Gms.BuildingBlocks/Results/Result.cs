namespace Gms.BuildingBlocks.Results;

public class Result
{
    public bool IsSuccess { get; }
    public int? StatusCode { get; }
    public string? ErrorCode { get; }
    public string? ErrorMessage { get; }

    protected Result(bool isSuccess, int? statusCode = null, string? errorCode = null, string? errorMessage = null)
    {
        IsSuccess = isSuccess;
        StatusCode = statusCode;
        ErrorCode = errorCode;
        ErrorMessage = errorMessage;
    }

    public static Result Ok() => new(true);

    public static Result Fail(int statusCode, string errorCode, string errorMessage)
        => new(false, statusCode, errorCode, errorMessage);
}

public sealed class Result<T> : Result
{
    public T? Value { get; }

    private Result(T value) : base(true) => Value = value;

    private Result(int statusCode, string errorCode, string errorMessage)
        : base(false, statusCode, errorCode, errorMessage) => Value = default;

    public static Result<T> Ok(T value) => new(value);

    public static new Result<T> Fail(int statusCode, string errorCode, string errorMessage)
        => new(statusCode, errorCode, errorMessage);
}
