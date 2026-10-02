using Microsoft.AspNetCore.Http;

namespace Gms.BuildingBlocks.Results;

/// <summary>Maps results to HTTP ProblemDetails with a machine-readable errorCode extension.</summary>
public static class ResultHttpExtensions
{
    public static IResult ToProblem(this Result result) => Microsoft.AspNetCore.Http.Results.Problem(
        statusCode: result.StatusCode ?? 400,
        title: result.ErrorCode,
        detail: result.ErrorMessage,
        extensions: new Dictionary<string, object?> { ["errorCode"] = result.ErrorCode });

    public static IResult ToIResult<T>(this Result<T> result)
        => result.IsSuccess ? Microsoft.AspNetCore.Http.Results.Ok(result.Value) : result.ToProblem();
}
