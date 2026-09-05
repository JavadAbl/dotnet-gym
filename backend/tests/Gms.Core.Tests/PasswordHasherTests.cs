using Gms.Modules.Identity.Infrastructure;
using Xunit;

namespace Gms.Core.Tests;

/// <summary>Pins the PBKDF2 password-hashing contract (login security depends on it).</summary>
public class PasswordHasherTests
{
    [Fact]
    public void Hash_then_Verify_roundtrips()
    {
        var stored = PasswordHasher.Hash("Admin@123");

        Assert.True(PasswordHasher.Verify("Admin@123", stored));
        Assert.False(PasswordHasher.Verify("admin@123", stored)); // case matters
        Assert.False(PasswordHasher.Verify("Admin@123 ", stored)); // no silent trimming
    }

    [Fact]
    public void Same_password_hashes_differ_but_both_verify()
    {
        var first = PasswordHasher.Hash("Operator@123");
        var second = PasswordHasher.Hash("Operator@123");

        // Unique salt per hash — equal stored values would be a rainbow-table weakness.
        Assert.NotEqual(first, second);
        Assert.True(PasswordHasher.Verify("Operator@123", first));
        Assert.True(PasswordHasher.Verify("Operator@123", second));
    }

    [Theory]
    [InlineData("")]
    [InlineData("plaintext")]
    [InlineData("md5$100000$abcd$efgh")]
    [InlineData("pbkdf2$abc$c2FsdA==$a2V5")]
    [InlineData("pbkdf2$0$abcd$abcd")]
    [InlineData("pbkdf2$100000$not-base64!!$a2V5")]
    [InlineData("pbkdf2$100000$c2FsdA==$")]
    public void Verify_rejects_malformed_stored_hashes(string stored)
    {
        Assert.False(PasswordHasher.Verify("whatever", stored));
    }
}
