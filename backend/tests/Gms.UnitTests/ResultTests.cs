using Gms.BuildingBlocks.Results;

namespace Gms.UnitTests;

public sealed class ResultTests
{
    [Fact]
    public void OkResult_IsSuccess_AndCarriesValue()
    {
        var result = Result<int>.Ok(42);
        Assert.True(result.IsSuccess);
        Assert.Equal(42, result.Value);
    }

    [Fact]
    public void FailResult_CarriesStatusAndErrorCode()
    {
        var result = Result<int>.Fail(401, "AUTH_INVALID_CREDENTIALS", "bad credentials");
        Assert.False(result.IsSuccess);
        Assert.Equal(401, result.StatusCode);
        Assert.Equal("AUTH_INVALID_CREDENTIALS", result.ErrorCode);
        Assert.Equal("bad credentials", result.ErrorMessage);
    }
}
