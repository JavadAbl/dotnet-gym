using Gms.BuildingBlocks.Domain;

namespace Gms.Modules.Catalog.Domain;

/// <summary>A buffet item. Prices live in <see cref="BuffetProductPrice"/> — the ONLY per-branch pricing in GMS.</summary>
public class BuffetProduct : Entity
{
    public string NameEn { get; set; } = default!;

    public string NameFa { get; set; } = default!;

    public bool IsActive { get; set; } = true;

    public List<BuffetProductPrice> Prices { get; set; } = [];
}

/// <summary>Per-branch price for a buffet product. (ProductId, BranchId) unique — branch id is cross-module.</summary>
public class BuffetProductPrice
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProductId { get; set; }

    public Guid BranchId { get; set; }

    public long PriceToman { get; set; }
}
