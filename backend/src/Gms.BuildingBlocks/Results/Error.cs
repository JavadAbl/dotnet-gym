namespace Gms.BuildingBlocks.Results;

/// <summary>A machine-readable, culture-neutral error carried by results and exceptions.</summary>
public sealed record Error(int StatusCode, string Code, string Message);
