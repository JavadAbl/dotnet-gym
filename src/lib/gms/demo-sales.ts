// Demo adapter — Sales & Wallet (Phase 3). Mirrors the .NET endpoints 1:1:
// same routes, same DTO shapes, same machine-readable errorCodes.
// The wallet ledger invariant (balanceAfter) is kept exactly like the backend.

import {
  GmsApiError,
  loadDb,
  saveDb,
  uid,
  wait,
  type DemoMemberPackageRecord,
  type DemoWalletTransaction,
} from "./demo-store";
import type {
  MemberPackage,
  MemberPackageDetail,
  MemberPackageQuery,
  MemberPackageStatus,
  PagedResult,
  PurchaseRequest,
  Receipt,
  RefundRequest,
  WalletSnapshot,
} from "./types";

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

function requireMemberPackage(db: ReturnType<typeof loadDb>, id: string): DemoMemberPackageRecord {
  const memberPackage = db.memberPackages.find((mp) => mp.id === id);
  if (!memberPackage) {
    throw new GmsApiError(404, "sales.member_package_not_found", "Member package not found.");
  }
  return memberPackage;
}

function toView(db: ReturnType<typeof loadDb>, mp: DemoMemberPackageRecord): MemberPackage {
  const member = db.members.find((m) => m.id === mp.memberId);
  const pkg = db.packages.find((p) => p.id === mp.packageId);
  const branch = db.branches.find((b) => b.id === mp.branchId);
  const nowIso = new Date().toISOString();
  return {
    ...mp,
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    packageNameEn: pkg?.nameEn ?? "—",
    packageNameFa: pkg?.nameFa ?? "—",
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
    isExpired: mp.expiresAtUtc <= nowIso,
  };
}

function receiptView(db: ReturnType<typeof loadDb>, receiptId: string): Receipt {
  const receipt = db.receipts.find((r) => r.id === receiptId);
  if (!receipt) throw new GmsApiError(404, "sales.receipt_not_found", "Receipt not found.");
  return receipt;
}

// Shared with the Phase 5 wallet adapter (same ledger semantics, one implementation).
export function ensureWalletAccount(db: ReturnType<typeof loadDb>, memberId: string) {
  let account = db.walletAccounts.find((a) => a.memberId === memberId);
  if (!account) {
    account = { id: uid(), memberId, balanceToman: 0 };
    db.walletAccounts.push(account);
  }
  return account;
}

export function walletCredit(
  db: ReturnType<typeof loadDb>,
  memberId: string,
  amount: number,
  kind: DemoWalletTransaction["kind"],
  at: string,
  note: string,
  relatedReceiptId?: string,
): void {
  const account = ensureWalletAccount(db, memberId);
  account.balanceToman += amount;
  db.walletTransactions.push({
    id: uid(),
    walletAccountId: account.id,
    amountToman: amount,
    kind,
    balanceAfter: account.balanceToman,
    relatedReceiptId: relatedReceiptId ?? null,
    note,
    createdAtUtc: at,
  });
}

export function walletDebit(
  db: ReturnType<typeof loadDb>,
  memberId: string,
  amount: number,
  kind: DemoWalletTransaction["kind"],
  at: string,
  note: string,
  relatedReceiptId?: string,
): void {
  const account = db.walletAccounts.find((a) => a.memberId === memberId);
  if (!account) {
    throw new GmsApiError(404, "wallet.account_not_found", "No wallet account exists for this member.");
  }
  if (account.balanceToman < amount) {
    throw new GmsApiError(
      409,
      "wallet.insufficient_balance",
      `Wallet balance ${account.balanceToman} is insufficient for a ${amount} Toman debit.`,
    );
  }
  account.balanceToman -= amount;
  db.walletTransactions.push({
    id: uid(),
    walletAccountId: account.id,
    amountToman: -amount,
    kind,
    balanceAfter: account.balanceToman,
    relatedReceiptId: relatedReceiptId ?? null,
    note,
    createdAtUtc: at,
  });
}

// ---------------------------------------------------------------- queries

export async function demoSearchMemberPackages(query: MemberPackageQuery): Promise<PagedResult<MemberPackage>> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 10;

  let items = [...db.memberPackages];

  if (query.memberId) items = items.filter((mp) => mp.memberId === query.memberId);
  if (query.branchId) items = items.filter((mp) => mp.branchId === query.branchId);
  if (query.status) items = items.filter((mp) => mp.status === query.status);

  const term = query.search?.trim().toLowerCase() ?? "";
  if (term) {
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
    items = items.filter((mp) => matchingMemberIds.has(mp.memberId));
  }

  items.sort((a, b) => (a.startedAtUtc < b.startedAtUtc ? 1 : -1));
  const totalCount = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize).map((mp) => toView(db, mp));
  return { items: paged, page, pageSize, totalCount };
}

export async function demoGetMemberPackage(id: string): Promise<MemberPackageDetail> {
  await wait(140);
  const db = loadDb();
  const mp = requireMemberPackage(db, id);
  const receipts = db.receipts
    .filter((r) => r.memberPackageId === id)
    .sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  return {
    package: toView(db, mp),
    freezes: [...mp.freezes].sort((a, b) => (a.frozenAtUtc < b.frozenAtUtc ? 1 : -1)),
    refund: mp.refund,
    receipts,
  };
}

// ---------------------------------------------------------------- purchase

export async function demoPurchaseMemberPackage(request: PurchaseRequest): Promise<MemberPackage> {
  await wait(320);
  const db = loadDb();

  const member = db.members.find((m) => m.id === request.memberId);
  if (!member) throw new GmsApiError(404, "member.not_found", "Member not found.");
  if (member.status !== "Active") {
    throw new GmsApiError(400, "sales.member_inactive", "Only active members can purchase packages.");
  }

  const branch = db.branches.find((b) => b.id === request.branchId);
  if (!branch) throw new GmsApiError(404, "branch.not_found", "Branch not found.");

  const pkg = db.packages.find((p) => p.id === request.packageId);
  if (!pkg) throw new GmsApiError(404, "catalog.package_not_found", "Exercise package not found.");
  if (!pkg.isActive) {
    throw new GmsApiError(400, "sales.package_inactive", "This package is no longer sold.");
  }
  if (!pkg.branchIds.includes(request.branchId)) {
    throw new GmsApiError(
      400,
      "catalog.package_not_available_in_branch",
      "The selected package is not available at the selected branch.",
    );
  }

  if (request.paymentMethod !== "Cash" && request.paymentMethod !== "Wallet") {
    throw new GmsApiError(400, "validation.failed", "Payment method must be Cash or Wallet.", {
      paymentMethod: ["Cash or Wallet are the only accepted values."],
    });
  }

  const nowIso = new Date().toISOString();
  const memberId = member.id;

  const record: DemoMemberPackageRecord = {
    id: uid(),
    memberId,
    packageId: pkg.id,
    branchId: request.branchId,
    sessionsTotal: pkg.sessionsCount,
    sessionsUsed: 0,
    startedAtUtc: nowIso,
    expiresAtUtc: daysFromNow(pkg.durationDays),
    status: "Active",
    pricePaidToman: pkg.priceToman,
    memberCode: member.code,
    memberFullName: member.fullName,
    packageNameEn: pkg.nameEn,
    packageNameFa: pkg.nameFa,
    branchNameEn: branch.nameEn,
    branchNameFa: branch.nameFa,
    isExpired: false,
    freezes: [],
    refund: null,
  };

  const receiptId = uid();
  db.memberPackages.push(record);
  db.receipts.push({
    id: receiptId,
    memberId,
    branchId: request.branchId,
    memberPackageId: record.id,
    kind: "PackagePurchase",
    paymentMethod: request.paymentMethod,
    amountToman: pkg.priceToman,
    note: null,
    createdAtUtc: nowIso,
    memberCode: member.code,
    memberFullName: member.fullName,
    branchNameEn: branch.nameEn,
    branchNameFa: branch.nameFa,
    packageNameEn: pkg.nameEn,
    packageNameFa: pkg.nameFa,
  });

  if (request.paymentMethod === "Wallet") {
    // Charge after the receipt id exists so the ledger row can reference it.
    // On insufficient balance this throws and nothing is persisted (saveDb is never reached).
    walletDebit(
      db,
      memberId,
      pkg.priceToman,
      "PackagePurchase",
      nowIso,
      `Package purchase: ${pkg.nameEn}`,
      receiptId,
    );
  }

  saveDb(db);
  return toView(db, record);
}

// ---------------------------------------------------------------- freeze / unfreeze

export async function demoFreezeMemberPackage(id: string): Promise<MemberPackageDetail> {
  await wait(260);
  const db = loadDb();
  const mp = requireMemberPackage(db, id);

  if (mp.status !== "Active") {
    throw new GmsApiError(409, "sales.invalid_state", "Only active packages can be frozen.");
  }
  if (mp.expiresAtUtc <= new Date().toISOString()) {
    throw new GmsApiError(409, "sales.package_expired", "Expired packages cannot be frozen.");
  }

  mp.status = "Frozen";
  mp.freezes.push({ id: uid(), frozenAtUtc: new Date().toISOString(), unfrozenAtUtc: null, frozenDays: null });
  saveDb(db);
  return demoGetMemberPackage(id);
}

export async function demoUnfreezeMemberPackage(id: string): Promise<MemberPackageDetail> {
  await wait(260);
  const db = loadDb();
  const mp = requireMemberPackage(db, id);

  if (mp.status !== "Frozen") {
    throw new GmsApiError(409, "sales.invalid_state", "Only frozen packages can be unfrozen.");
  }

  const now = new Date();
  const openFreeze = [...mp.freezes]
    .filter((f) => !f.unfrozenAtUtc)
    .sort((a, b) => (a.frozenAtUtc < b.frozenAtUtc ? 1 : -1))[0];

  let frozenDays = 0;
  if (openFreeze) {
    frozenDays = Math.max(0, Math.ceil((now.getTime() - new Date(openFreeze.frozenAtUtc).getTime()) / 86_400_000));
    openFreeze.unfrozenAtUtc = now.toISOString();
    openFreeze.frozenDays = frozenDays;
  }

  // Locked decision #6: unfreeze shifts the expiry forward by the frozen days.
  mp.expiresAtUtc = daysFromNow(
    (new Date(mp.expiresAtUtc).getTime() - Date.now()) / 86_400_000 + frozenDays,
  );
  mp.status = "Active";
  saveDb(db);
  return demoGetMemberPackage(id);
}

// ---------------------------------------------------------------- refund

export async function demoRefundMemberPackage(id: string, request: RefundRequest): Promise<MemberPackageDetail> {
  await wait(320);
  const db = loadDb();
  const mp = requireMemberPackage(db, id);

  if (mp.status === "Refunded") {
    throw new GmsApiError(409, "sales.already_refunded", "This package has already been refunded.");
  }

  let amount: number;
  if (request.amountToman !== undefined) {
    if (request.amountToman <= 0 || request.amountToman > mp.pricePaidToman) {
      throw new GmsApiError(
        400,
        "sales.refund_amount_invalid",
        `Refund amount must be between 1 and ${mp.pricePaidToman} Toman.`,
      );
    }
    amount = request.amountToman;
  } else {
    const remaining = Math.max(0, mp.sessionsTotal - mp.sessionsUsed);
    amount = mp.sessionsTotal > 0 ? Math.floor((mp.pricePaidToman * remaining) / mp.sessionsTotal) : 0;
  }

  const purchaseReceipt = db.receipts
    .filter((r) => r.memberPackageId === mp.id && r.kind === "PackagePurchase")
    .sort((a, b) => (a.createdAtUtc > b.createdAtUtc ? 1 : -1))[0];
  const method = purchaseReceipt?.paymentMethod ?? "Cash";

  const nowIso = new Date().toISOString();
  const reason = request.reason?.trim() || null;

  if (method === "Wallet" && amount > 0) {
    walletCredit(db, mp.memberId, amount, "PackageRefund", nowIso, reason ? `Package refund: ${reason}` : "Package refund.");
  }

  const refundReceiptId = uid();
  mp.status = "Refunded";
  mp.refund = {
    id: uid(),
    amountToman: amount,
    reason,
    refundedAtUtc: nowIso,
  };

  const member = db.members.find((m) => m.id === mp.memberId);
  const branch = db.branches.find((b) => b.id === mp.branchId);
  db.receipts.push({
    id: refundReceiptId,
    memberId: mp.memberId,
    branchId: mp.branchId,
    memberPackageId: mp.id,
    kind: "PackageRefund",
    paymentMethod: method,
    amountToman: amount,
    note: reason ? `Package refund: ${reason}` : "Package refund.",
    createdAtUtc: nowIso,
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
    packageNameEn: mp.packageNameEn,
    packageNameFa: mp.packageNameFa,
  });

  saveDb(db);
  return demoGetMemberPackage(id);
}

// ---------------------------------------------------------------- receipts + wallet snapshot

export async function demoListReceipts(query: {
  memberId?: string;
  branchId?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<Receipt>> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 10;

  let items = [...db.receipts];
  if (query.memberId) items = items.filter((r) => r.memberId === query.memberId);
  if (query.branchId) items = items.filter((r) => r.branchId === query.branchId);
  if (query.kind) items = items.filter((r) => r.kind === query.kind);

  items.sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  const totalCount = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, page, pageSize, totalCount };
}

export async function demoGetWalletSnapshot(memberId: string): Promise<WalletSnapshot> {
  await wait(140);
  const db = loadDb();
  const account = db.walletAccounts.find((a) => a.memberId === memberId);
  const transactions = account
    ? db.walletTransactions
        .filter((t) => t.walletAccountId === account.id)
        .sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1))
        .slice(0, 10)
        .map(({ walletAccountId: _accountId, ...rest }) => rest)
    : [];
  return {
    memberId,
    hasAccount: Boolean(account),
    balanceToman: account?.balanceToman ?? 0,
    recentTransactions: transactions,
  };
}

export type { MemberPackageStatus };
