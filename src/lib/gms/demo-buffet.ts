// Demo adapter — Buffet (Phase 7). Mirrors the .NET endpoints 1:1:
// same routes, same DTO shapes, same machine-readable errorCodes.
// Wallet orders keep the ledger invariant (balanceAfter) exactly like the backend.

import {
  GmsApiError,
  loadDb,
  saveDb,
  uid,
  wait,
  type DemoBuffetOrderRecord,
} from "./demo-store";
import { walletDebit } from "./demo-sales";
import type {
  BuffetOrder,
  BuffetOrderQuery,
  BuffetProduct,
  BuffetSummary,
  CreateBuffetOrderRequest,
  CreateProductRequest,
  PagedResult,
  PaymentMethod,
  UpdateProductRequest,
} from "./types";

const dbPaymentMethod = (value: string | undefined | null): PaymentMethod | null =>
  value === "Cash" || value === "Wallet" ? value : null;

// ---------------------------------------------------------------- order views (enriched at read time)

function toOrderView(db: ReturnType<typeof loadDb>, record: DemoBuffetOrderRecord): BuffetOrder {
  const member = db.members.find((m) => m.id === record.memberId);
  const branch = db.branches.find((b) => b.id === record.branchId);
  return {
    ...record,
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
  };
}

// ---------------------------------------------------------------- paged order history

export async function demoSearchBuffetOrders(query: BuffetOrderQuery): Promise<PagedResult<BuffetOrder>> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 10;

  let records = [...db.buffetOrders];

  if (query.branchId) {
    records = records.filter((o) => o.branchId === query.branchId);
  }
  if (query.memberId) {
    records = records.filter((o) => o.memberId === query.memberId);
  }
  if (query.paymentMethod) {
    records = records.filter((o) => o.paymentMethod === query.paymentMethod);
  }

  const term = query.search?.trim().toLowerCase() ?? "";
  if (term) {
    // Mirrors IMembersModule.FindIdsAsync: name / code / phone / card, then filter by ids.
    const matchingMemberIds = new Set(
      db.members
        .filter(
          (m) =>
            m.fullName.toLowerCase().includes(term) ||
            m.code.toLowerCase().includes(term) ||
            (m.phoneNumber ?? "").includes(term) ||
            (m.cardCode ?? "").toLowerCase().includes(term),
        )
        .map((m) => m.id),
    );
    records = records.filter((o) => matchingMemberIds.has(o.memberId));
  }

  records.sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  const totalCount = records.length;
  const paged = records.slice((page - 1) * pageSize, page * pageSize).map((record) => toOrderView(db, record));
  return { items: paged, page, pageSize, totalCount };
}

// ---------------------------------------------------------------- create POS order

export async function demoCreateBuffetOrder(request: CreateBuffetOrderRequest): Promise<BuffetOrder> {
  await wait(320);
  const db = loadDb();

  // ---- items gate (same precedence as the endpoint: items → branch → member → method → products)
  if (request.items.length === 0) {
    throw new GmsApiError(400, "buffet.items_empty", "A buffet order needs at least one item.");
  }

  const errors: Record<string, string[]> = {};
  request.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      errors[`items[${index}].quantity`] = ["Quantity must be between 1 and 99."];
    }
  });
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  // merge duplicate products (the endpoint aggregates quantities the same way)
  const mergedQuantities = new Map<string, number>();
  for (const item of request.items) {
    mergedQuantities.set(item.productId, (mergedQuantities.get(item.productId) ?? 0) + item.quantity);
  }

  // ---- branch gate (the demo caller resolves the branch from the session —
  //      reception/buffet's branch claim / the admin's explicit picker, like check-in).
  if (!request.branchId) {
    throw new GmsApiError(400, "validation.failed", "Branch could not be determined.", {
      branchId: ["Select the branch for this order."],
    });
  }
  const branch = db.branches.find((b) => b.id === request.branchId);
  if (!branch) {
    throw new GmsApiError(404, "branch.not_found", "Branch not found.");
  }

  // ---- member gate: must exist and be Active (same gate as package purchase / top-up)
  const member = db.members.find((m) => m.id === request.memberId);
  if (!member) {
    throw new GmsApiError(404, "buffet.member_not_found", "Member not found.");
  }
  if (member.status !== "Active") {
    throw new GmsApiError(400, "buffet.member_inactive", "Only active members can be charged at the buffet.");
  }

  // ---- payment method: single method per receipt (locked decision #5)
  if (request.paymentMethod !== "Cash" && request.paymentMethod !== "Wallet") {
    throw new GmsApiError(400, "validation.failed", "Payment method must be Cash or Wallet.", {
      paymentMethod: ["Cash or Wallet are the only accepted values."],
    });
  }

  // ---- price resolution from the per-branch catalog (server-side totals; the client never dictates money)
  const nowIso = new Date().toISOString();
  let totalToman = 0;
  const items = [...mergedQuantities.entries()].map(([productId, quantity]) => {
    const product = db.products.find((p) => p.id === productId);
    if (!product) {
      throw new GmsApiError(404, "catalog.product_not_found", "Buffet product not found.");
    }
    if (!product.isActive) {
      throw new GmsApiError(400, "buffet.product_inactive", `Buffet product '${product.nameEn}' is no longer sold.`);
    }
    const price = product.prices.find((p) => p.branchId === branch.id);
    if (!price) {
      throw new GmsApiError(
        400,
        "buffet.product_not_priced_in_branch",
        `Buffet product '${product.nameEn}' has no price for the selected branch.`,
      );
    }
    const lineTotalToman = price.priceToman * quantity;
    totalToman += lineTotalToman;
    return {
      productId: product.id,
      nameEn: product.nameEn,
      nameFa: product.nameFa,
      quantity,
      unitPriceToman: price.priceToman,
      lineTotalToman,
    };
  });

  const note = request.note?.trim() || null;
  const receiptId = uid();

  // Wallet: debit first (throws wallet.insufficient_balance on 409) — the ledger row links
  // to the receipt; localStorage commits everything atomically, no compensation needed.
  if (request.paymentMethod === "Wallet") {
    walletDebit(db, member.id, totalToman, "BuffetPurchase", nowIso, note ?? "Buffet order", receiptId);
  }

  db.receipts.push({
    id: receiptId,
    memberId: member.id,
    branchId: branch.id,
    memberPackageId: null, // buffet orders are not tied to any exercise package.
    kind: "BuffetPurchase",
    paymentMethod: request.paymentMethod,
    amountToman: totalToman,
    note,
    createdAtUtc: nowIso,
    memberCode: member.code,
    memberFullName: member.fullName,
    branchNameEn: branch.nameEn,
    branchNameFa: branch.nameFa,
    packageNameEn: "—",
    packageNameFa: "—",
  });

  const record: DemoBuffetOrderRecord = {
    id: uid(),
    memberId: member.id,
    branchId: branch.id,
    paymentMethod: request.paymentMethod,
    totalToman,
    receiptId,
    note,
    createdAtUtc: nowIso,
    items,
  };
  db.buffetOrders.push(record);
  saveDb(db);

  return toOrderView(db, record);
}

// ---------------------------------------------------------------- counter KPIs (today, UTC)

export async function demoGetBuffetSummary(branchId?: string): Promise<BuffetSummary> {
  await wait(150);
  const db = loadDb();
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const todays = db.buffetOrders.filter(
    (o) => o.createdAtUtc >= todayUtc.toISOString() && (!branchId || o.branchId === branchId),
  );
  const revenueTodayToman = todays.reduce((sum, o) => sum + o.totalToman, 0);
  const cashRevenueTodayToman = todays
    .filter((o) => o.paymentMethod === "Cash")
    .reduce((sum, o) => sum + o.totalToman, 0);
  return {
    ordersToday: todays.length,
    revenueTodayToman,
    cashRevenueTodayToman,
    walletRevenueTodayToman: revenueTodayToman - cashRevenueTodayToman,
  };
}

// ---------------------------------------------------------------- product & per-branch price admin

function validateProductInput(
  db: ReturnType<typeof loadDb>,
  nameEn: string,
  nameFa: string,
  prices: Array<{ branchId: string; priceToman: number }>,
  excludeId?: string,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  if (!nameEn.trim() || nameEn.trim().length > 128) {
    errors.nameEn = ["Required, max 128 characters."];
  }
  if (!nameFa.trim() || nameFa.trim().length > 128) {
    errors.nameFa = ["Required, max 128 characters."];
  }

  if (prices.length === 0) {
    errors.prices = ["At least one branch price is required."];
  }

  const seenBranches = new Set<string>();
  const duplicateBranches = new Set<string>();
  for (const price of prices) {
    if (seenBranches.has(price.branchId)) duplicateBranches.add(price.branchId);
    seenBranches.add(price.branchId);
  }
  for (const branchId of duplicateBranches) {
    errors[`prices[${branchId}]`] = ["Duplicate branch price."];
  }

  for (const price of prices) {
    if (!Number.isInteger(price.priceToman) || price.priceToman <= 0) {
      errors[`prices[${price.branchId}]`] = ["Price must be a positive integer amount of Toman."];
    } else if (!db.branches.some((b) => b.id === price.branchId && b.isActive)) {
      errors[`prices[${price.branchId}]`] = ["Unknown or inactive branch."];
    }
  }

  const nameEnLower = nameEn.trim().toLowerCase();
  const nameFaLower = nameFa.trim().toLowerCase();
  if (
    db.products.some(
      (p) =>
        p.id !== excludeId &&
        (p.nameEn.toLowerCase() === nameEnLower || p.nameFa.toLowerCase() === nameFaLower),
    )
  ) {
    errors.nameEn = ["A buffet product with this name already exists."];
  }

  return errors;
}

export async function demoCreateProduct(request: CreateProductRequest): Promise<BuffetProduct> {
  await wait(280);
  const db = loadDb();

  const errors = validateProductInput(db, request.nameEn, request.nameFa, request.prices);
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  const product: BuffetProduct = {
    id: uid(),
    nameEn: request.nameEn.trim(),
    nameFa: request.nameFa.trim(),
    isActive: request.isActive ?? true,
    prices: request.prices.map((p) => ({ branchId: p.branchId, priceToman: p.priceToman })),
  };
  db.products.push(product);
  saveDb(db);
  return product;
}

export async function demoUpdateProduct(id: string, request: UpdateProductRequest): Promise<BuffetProduct> {
  await wait(280);
  const db = loadDb();

  const product = db.products.find((p) => p.id === id);
  if (!product) {
    throw new GmsApiError(404, "catalog.product_not_found", "Buffet product not found.");
  }

  const errors = validateProductInput(db, request.nameEn, request.nameFa, request.prices, id);
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  product.nameEn = request.nameEn.trim();
  product.nameFa = request.nameFa.trim();
  product.isActive = request.isActive;
  // Wholesale price replacement (upsert + drop) — past orders keep their snapshots.
  product.prices = request.prices.map((p) => ({ branchId: p.branchId, priceToman: p.priceToman }));
  saveDb(db);
  return product;
}
