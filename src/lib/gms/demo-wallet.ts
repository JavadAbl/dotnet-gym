// Demo adapter — Wallet (Phase 5). Mirrors the .NET endpoints 1:1:
// same routes, same DTO shapes, same machine-readable errorCodes.
// The wallet ledger invariant (balanceAfter) is kept exactly like the backend.

import {
  GmsApiError,
  loadDb,
  saveDb,
  uid,
  wait,
  type DemoWalletTransaction,
} from "./demo-store";
import { ensureWalletAccount } from "./demo-sales";
import type {
  PagedResult,
  Receipt,
  TopUpRequest,
  TopUpResponse,
  WalletAccountRow,
  WalletAccountsPage,
  WalletAccountsQuery,
  WalletTransactionsQuery,
  WalletTransaction,
} from "./types";

const dbKind = (kind: string | undefined | null): WalletTransaction["kind"] | null => {
  switch (kind) {
    case "TopUp":
    case "PackagePurchase":
    case "PackageRefund":
    case "BuffetPurchase":
      return kind;
    default:
      return null;
  }
};

// ---------------------------------------------------------------- accounts (paged)

export async function demoListWalletAccounts(
  query: WalletAccountsQuery,
): Promise<WalletAccountsPage> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 10;

  let accounts = [...db.walletAccounts];

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
    accounts = accounts.filter((a) => matchingMemberIds.has(a.memberId));
  }

  // Backend order: balance desc, then creation order (stable in JS).
  accounts.sort((a, b) => b.balanceToman - a.balanceToman);

  const memberById = new Map(db.members.map((m) => [m.id, m]));
  const lastActivityByAccount = new Map<string, string>();
  for (const t of db.walletTransactions) {
    const current = lastActivityByAccount.get(t.walletAccountId);
    if (!current || t.createdAtUtc > current) {
      lastActivityByAccount.set(t.walletAccountId, t.createdAtUtc);
    }
  }

  const totalCount = accounts.length;
  const totalBalanceToman = accounts.reduce((sum, account) => sum + account.balanceToman, 0);
  const paged = accounts.slice((page - 1) * pageSize, page * pageSize).map((account) => {
    const member = memberById.get(account.memberId);
    return {
      memberId: account.memberId,
      memberCode: member?.code ?? "—",
      memberFullName: member?.fullName ?? "—",
      balanceToman: account.balanceToman,
      lastActivityAtUtc: lastActivityByAccount.get(account.id) ?? null,
    };
  });
  return { items: paged, page, pageSize, totalCount, totalBalanceToman };
}

// ---------------------------------------------------------------- paged ledger

export async function demoListWalletTransactions(
  memberId: string,
  query: WalletTransactionsQuery,
): Promise<PagedResult<WalletTransaction>> {
  await wait(160);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 10;

  const account = db.walletAccounts.find((a) => a.memberId === memberId);
  if (!account) {
    // No wallet yet — an empty ledger, not an error (the UI offers a top-up).
    return { items: [], page, pageSize, totalCount: 0 };
  }

  let items = db.walletTransactions.filter((t) => t.walletAccountId === account.id);

  const kind = dbKind(query.kind);
  if (kind) {
    items = items.filter((t) => t.kind === kind);
  }

  items = [...items].sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  const totalCount = items.length;
  const paged = items
    .slice((page - 1) * pageSize, page * pageSize)
    .map(({ walletAccountId: _accountId, ...rest }) => rest);
  return { items: paged, page, pageSize, totalCount };
}

// ---------------------------------------------------------------- top-up

export async function demoTopUp(memberId: string, request: TopUpRequest): Promise<TopUpResponse> {
  await wait(320);
  const db = loadDb();

  if (!Number.isInteger(request.amountToman) || request.amountToman <= 0) {
    throw new GmsApiError(400, "wallet.invalid_amount", "Top-up amount must be a positive integer amount of Toman.", {
      amountToman: ["Enter a positive Toman amount."],
    });
  }

  // ---- branch gate (the demo caller resolves the branch from the session —
  //      reception's branch claim / the admin's explicit picker, like check-in).
  if (!request.branchId) {
    throw new GmsApiError(400, "validation.failed", "Branch could not be determined.", {
      branchId: ["Select the branch for this top-up."],
    });
  }
  const branch = db.branches.find((b) => b.id === request.branchId);
  if (!branch) {
    throw new GmsApiError(404, "branch.not_found", "Branch not found.");
  }

  // ---- member gate: must exist and be Active (same gate as package purchase).
  const member = db.members.find((m) => m.id === memberId);
  if (!member) {
    throw new GmsApiError(404, "wallet.member_not_found", "Member not found.");
  }
  if (member.status !== "Active") {
    throw new GmsApiError(400, "wallet.member_inactive", "Wallets can only be topped up for active members.");
  }

  const note = request.note?.trim() || "Wallet top-up (cash)";
  const nowIso = new Date().toISOString();

  // Credit → receipt → link: the same orchestration as the endpoint, one localStorage commit.
  const receiptId = uid();
  const receipt: Receipt = {
    id: receiptId,
    memberId: member.id,
    branchId: branch.id,
    memberPackageId: null, // TopUp receipts are not tied to any exercise package.
    kind: "TopUp",
    paymentMethod: "Cash", // cash-in at the desk by definition.
    amountToman: request.amountToman,
    note,
    createdAtUtc: nowIso,
    memberCode: member.code,
    memberFullName: member.fullName,
    branchNameEn: branch.nameEn,
    branchNameFa: branch.nameFa,
    packageNameEn: "—",
    packageNameFa: "—",
  };

  ensureWalletAccount(db, member.id);
  const transactionId = pushLedgerRow(db, member.id, request.amountToman, nowIso, note, receiptId);

  db.receipts.push(receipt);
  saveDb(db);

  const account = db.walletAccounts.find((a) => a.memberId === member.id)!;
  return {
    memberId: member.id,
    receiptId,
    transactionId,
    amountToman: request.amountToman,
    balanceToman: account.balanceToman,
  };
}

function pushLedgerRow(
  db: ReturnType<typeof loadDb>,
  memberId: string,
  amount: number,
  at: string,
  note: string,
  relatedReceiptId: string,
): string {
  const account = ensureWalletAccount(db, memberId);
  account.balanceToman += amount;
  const row: DemoWalletTransaction = {
    id: uid(),
    walletAccountId: account.id,
    amountToman: amount,
    kind: "TopUp",
    balanceAfter: account.balanceToman,
    relatedReceiptId,
    note,
    createdAtUtc: at,
  };
  db.walletTransactions.push(row);
  return row.id;
}
