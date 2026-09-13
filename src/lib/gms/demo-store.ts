// Demo adapter — implements the same contract as the .NET API so the sandbox preview
// is fully interactive without a running backend. State persists in localStorage.
// It mirrors backend seeds (Phase 1) and member endpoints (Phase 2).

import type {
  AttendanceEntry,
  Branch,
  BuffetProduct,
  CreatePackageRequest,
  CreateUserRequest,
  ExercisePackage,
  LoginResponse,
  Member,
  MemberPackage,
  MemberQuery,
  MemberStatus,
  MemberWriteModel,
  PackageFreeze,
  PackageRefund,
  PagedResult,
  PaymentMethod,
  Receipt,
  SystemUser,
  WalletTransaction,
} from "./types";

const DB_KEY = "gms.demo.db.v10";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface DemoUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "reception" | "buffet" | "coach";
  branchId?: string | null;
  isActive: boolean;
}

interface DemoWalletAccount {
  id: string;
  memberId: string;
  balanceToman: number;
}

/** Stored record incl. the audit data served by the package-detail endpoint. */
export type DemoMemberPackageRecord = MemberPackage & {
  freezes: PackageFreeze[];
  refund: PackageRefund | null;
};

/** Ledger row incl. internal account linkage (not part of the API contract). */
export type DemoWalletTransaction = WalletTransaction & { walletAccountId: string };

/** Attendance entry stored fully enriched (the demo resolves names at read time). */
export type DemoAttendanceRecord = AttendanceEntry;

/** Coaching raw rows (Phase 6) — names are re-resolved at read time, mirroring the backend enrichment. */
export interface DemoCoachAssignmentRecord {
  id: string;
  coachId: string;
  memberId: string;
  branchId: string;
  assignedAtUtc: string;
  releasedAtUtc: string | null;
  note: string | null;
}

export interface DemoTrainingPlanRecord {
  id: string;
  coachId: string;
  memberId: string;
  title: string;
  goal: string | null;
  content: string;
  isActive: boolean;
  archivedAtUtc: string | null;
  createdAtUtc: string;
}

export interface DemoTrainingRecordRecord {
  id: string;
  coachId: string;
  memberId: string;
  trainingPlanId: string | null;
  branchId: string;
  performedAtUtc: string;
  summary: string;
  durationMinutes: number | null;
  intensity: "Low" | "Medium" | "High" | null;
  note: string | null;
}

/** Buffet POS order (Phase 7) — item names/prices are snapshots taken at order time. */
export interface DemoBuffetOrderRecord {
  id: string;
  memberId: string;
  branchId: string;
  paymentMethod: PaymentMethod;
  totalToman: number;
  receiptId: string | null;
  note: string | null;
  createdAtUtc: string;
  items: Array<{
    productId: string;
    nameEn: string;
    nameFa: string;
    quantity: number;
    unitPriceToman: number;
    lineTotalToman: number;
  }>;
}

interface DemoDb {
  seededAt: string;
  users: DemoUser[];
  branches: Branch[];
  packages: ExercisePackage[];
  products: BuffetProduct[];
  members: Member[];
  memberPackages: DemoMemberPackageRecord[];
  receipts: Receipt[];
  walletAccounts: DemoWalletAccount[];
  walletTransactions: DemoWalletTransaction[];
  attendance: DemoAttendanceRecord[];
  coachAssignments: DemoCoachAssignmentRecord[];
  trainingPlans: DemoTrainingPlanRecord[];
  trainingRecords: DemoTrainingRecordRecord[];
  buffetOrders: DemoBuffetOrderRecord[];
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

function seedDb(): DemoDb {
  const northId = uid();
  const southId = uid();
  const now = new Date().toISOString();

  const members: Member[] = [
    {
      id: uid(),
      code: "M-00001",
      fullName: "علی محمدی",
      phoneNumber: "09121110001",
      gender: "Male",
      birthDateUtc: "1994-03-12T00:00:00.000Z",
      joinDateUtc: now,
      homeBranchId: northId,
      cardCode: "RF-0001",
      status: "Active",
      notes: null,
    },
    {
      id: uid(),
      code: "M-00002",
      fullName: "سارا کریمی",
      phoneNumber: "09121110002",
      gender: "Female",
      birthDateUtc: "1998-09-25T00:00:00.000Z",
      joinDateUtc: now,
      homeBranchId: southId,
      cardCode: "RF-0002",
      status: "Active",
      notes: null,
    },
    {
      id: uid(),
      code: "M-00003",
      fullName: "رضا حسینی",
      phoneNumber: "09121110003",
      gender: "Male",
      birthDateUtc: null,
      joinDateUtc: now,
      homeBranchId: southId,
      cardCode: "RF-0003",
      status: "Inactive",
      notes: "درخواست تعلیق موقت",
    },
    {
      id: uid(),
      code: "M-00004",
      fullName: "مریم احمدی",
      phoneNumber: "09121110004",
      gender: "Female",
      birthDateUtc: "2001-01-05T00:00:00.000Z",
      joinDateUtc: now,
      homeBranchId: northId,
      cardCode: "RF-0004",
      status: "Active",
      notes: null,
    },
  ];

  const packages: ExercisePackage[] = [
    {
      id: uid(),
      nameEn: "VIP — 12 Sessions / 1 Month",
      nameFa: "ویژه — ۱۲ جلسه / یک ماه",
      kind: "Exercise",
      sessionsCount: 12,
      durationDays: 30,
      priceToman: 2_500_000,
      isActive: true,
      branchIds: [northId, southId],
    },
    {
      id: uid(),
      nameEn: "Basic — 8 Sessions / 2 Weeks",
      nameFa: "پایه — ۸ جلسه / دو هفته",
      kind: "Exercise",
      sessionsCount: 8,
      durationDays: 14,
      priceToman: 1_200_000,
      isActive: true,
      branchIds: [southId],
    },
    // v2 — private coach packages: buying one entitles the member to personal training;
    // coaches can only serve members with an active private package (Coaching gate).
    {
      id: uid(),
      nameEn: "Private Coaching — 30 Sessions / 2 Months",
      nameFa: "مربی خصوصی — ۳۰ جلسه / دو ماه",
      kind: "PrivateCoaching",
      sessionsCount: 30,
      durationDays: 60,
      priceToman: 15_000_000,
      isActive: true,
      branchIds: [northId, southId],
    },
    {
      id: uid(),
      nameEn: "Private Coaching — 20 Sessions / 1 Month",
      nameFa: "مربی خصوصی — ۲۰ جلسه / یک ماه",
      kind: "PrivateCoaching",
      sessionsCount: 20,
      durationDays: 30,
      priceToman: 11_000_000,
      isActive: true,
      branchIds: [northId, southId],
    },
  ];

  const products: BuffetProduct[] = [
    {
      id: uid(),
      nameEn: "Water 500ml",
      nameFa: "آب معدنی ۵۰۰ میلی‌لیتر",
      isActive: true,
      prices: [
        { branchId: northId, priceToman: 15_000 },
        { branchId: southId, priceToman: 15_000 },
      ],
    },
    {
      id: uid(),
      nameEn: "Protein Bar",
      nameFa: "بار پروتئین",
      isActive: true,
      prices: [
        { branchId: northId, priceToman: 85_000 },
        { branchId: southId, priceToman: 95_000 },
      ],
    },
    {
      id: uid(),
      nameEn: "Energy Drink",
      nameFa: "نوشیدنی انرژی‌زا",
      isActive: true,
      prices: [
        { branchId: northId, priceToman: 60_000 },
        { branchId: southId, priceToman: 60_000 },
      ],
    },
  ];

  const db: DemoDb = {
    seededAt: now,
    users: [
      { id: uid(), username: "admin", password: "Admin@123", displayName: "مدیر سیستم", role: "admin", branchId: null, isActive: true },
      { id: uid(), username: "reception.north", password: "Operator@123", displayName: "پذیرش — شعبه شمال", role: "reception", branchId: northId, isActive: true },
      { id: uid(), username: "reception.south", password: "Operator@123", displayName: "پذیرش — شعبه جنوب", role: "reception", branchId: southId, isActive: true },
      { id: uid(), username: "buffet.north", password: "Operator@123", displayName: "بوفه — شعبه شمال", role: "buffet", branchId: northId, isActive: true },
      { id: uid(), username: "coach.north", password: "Operator@123", displayName: "مربی — شعبه شمال", role: "coach", branchId: northId, isActive: true },
      { id: uid(), username: "coach.south", password: "Operator@123", displayName: "مربی — شعبه جنوب", role: "coach", branchId: southId, isActive: true },
    ],
    branches: [
      { id: northId, nameEn: "North Branch", nameFa: "شعبه شمال", city: "تهران", phoneNumber: "021-22000001", isActive: true },
      { id: southId, nameEn: "South Branch", nameFa: "شعبه جنوب", city: "تهران", phoneNumber: "021-22000002", isActive: true },
    ],
    packages,
    products,
    members,
    memberPackages: [],
    receipts: [],
    walletAccounts: [],
    walletTransactions: [],
    attendance: [],
    coachAssignments: [],
    trainingPlans: [],
    trainingRecords: [],
    buffetOrders: [],
  };

  seedDemoSales(db);
  seedDemoAttendance(db);
  seedDemoWallet(db);
  seedDemoCoaching(db);
  seedDemoBuffet(db);
  return db;
}

// ---------------------------------------------------------------- Phase 3 demo seeds (mirror of SalesSeeder/WalletSeeder)

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

function seedDemoSales(db: DemoDb): void {
  const north = db.branches.find((b) => b.nameEn === "North Branch")!.id;
  const south = db.branches.find((b) => b.nameEn === "South Branch")!.id;
  const vip = db.packages.find((p) => p.nameEn.startsWith("VIP"))!;
  const basic = db.packages.find((p) => p.nameEn.startsWith("Basic"))!;
  const memberByCode = (code: string) => db.members.find((m) => m.code === code)!;

  const ali = memberByCode("M-00001");
  const sara = memberByCode("M-00002");
  const reza = memberByCode("M-00003");
  const maryam = memberByCode("M-00004");

  // wallet accounts + opening top-ups — each backed by a real TopUp receipt so the
  // receipts list reconciles with the ledger exactly like the Phase 5 backend seeds.
  const branchById = (id: string) => db.branches.find((b) => b.id === id)!;
  const credit = (member: Member, amount: number, at: string, note = "Opening balance (seed).") => {
    let account = db.walletAccounts.find((a) => a.memberId === member.id);
    if (!account) {
      account = { id: uid(), memberId: member.id, balanceToman: 0 };
      db.walletAccounts.push(account);
    }
    account.balanceToman += amount;
    const receiptId = uid();
    const branch = branchById(member.homeBranchId);
    db.receipts.push({
      id: receiptId,
      memberId: member.id,
      branchId: member.homeBranchId,
      memberPackageId: null,
      kind: "TopUp",
      paymentMethod: "Cash",
      amountToman: amount,
      note,
      createdAtUtc: at,
      memberCode: member.code,
      memberFullName: member.fullName,
      branchNameEn: branch.nameEn,
      branchNameFa: branch.nameFa,
      packageNameEn: "—",
      packageNameFa: "—",
    });
    db.walletTransactions.push({
      id: uid(),
      walletAccountId: account.id,
      amountToman: amount,
      kind: "TopUp",
      balanceAfter: account.balanceToman,
      relatedReceiptId: receiptId,
      note,
      createdAtUtc: at,
    });
  };

  const debit = (memberId: string, amount: number, kind: WalletTransaction["kind"], at: string, note: string, receiptId?: string) => {
    const account = db.walletAccounts.find((a) => a.memberId === memberId)!;
    account.balanceToman -= amount;
    db.walletTransactions.push({
      id: uid(),
      walletAccountId: account.id,
      amountToman: -amount,
      kind,
      balanceAfter: account.balanceToman,
      relatedReceiptId: receiptId ?? null,
      note,
      createdAtUtc: at,
    });
  };

  credit(ali, 5_000_000, daysFromNow(-7));
  credit(sara, 3_000_000, daysFromNow(-7));
  credit(reza, 500_000, daysFromNow(-7));
  credit(maryam, 1_000_000, daysFromNow(-7));

  // 1) Ali — VIP @ North, WALLET, Active (used 3/12)
  const aliVipId = uid();
  const aliVipReceiptId = uid();
  db.memberPackages.push({
    id: aliVipId,
    memberId: ali.id,
    packageId: vip.id,
    branchId: north,
    packageKind: "Exercise",
    sessionsTotal: vip.sessionsCount,
    sessionsUsed: 3,
    startedAtUtc: daysFromNow(-6),
    expiresAtUtc: daysFromNow(-6 + vip.durationDays),
    status: "Active",
    pricePaidToman: vip.priceToman,
    memberCode: ali.code,
    memberFullName: ali.fullName,
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
    branchNameEn: "North Branch",
    branchNameFa: "شعبه شمال",
    isExpired: false,
    freezes: [],
    refund: null,
  });
  db.receipts.push({
    id: aliVipReceiptId,
    memberId: ali.id,
    branchId: north,
    memberPackageId: aliVipId,
    kind: "PackagePurchase",
    paymentMethod: "Wallet",
    amountToman: vip.priceToman,
    note: null,
    createdAtUtc: daysFromNow(-6),
    memberCode: ali.code,
    memberFullName: ali.fullName,
    branchNameEn: "North Branch",
    branchNameFa: "شعبه شمال",
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
  });
  debit(ali.id, vip.priceToman, "PackagePurchase", daysFromNow(-6), "Package purchase: VIP (seed).", aliVipReceiptId);

  // 2) Sara — Basic @ South, cash, Active (used 2/8)
  const saraBasicId = uid();
  db.memberPackages.push({
    id: saraBasicId,
    memberId: sara.id,
    packageId: basic.id,
    branchId: south,
    packageKind: "Exercise",
    sessionsTotal: basic.sessionsCount,
    sessionsUsed: 2,
    startedAtUtc: daysFromNow(-4),
    expiresAtUtc: daysFromNow(-4 + basic.durationDays),
    status: "Active",
    pricePaidToman: basic.priceToman,
    memberCode: sara.code,
    memberFullName: sara.fullName,
    packageNameEn: basic.nameEn,
    packageNameFa: basic.nameFa,
    branchNameEn: "South Branch",
    branchNameFa: "شعبه جنوب",
    isExpired: false,
    freezes: [],
    refund: null,
  });
  db.receipts.push({
    id: uid(),
    memberId: sara.id,
    branchId: south,
    memberPackageId: saraBasicId,
    kind: "PackagePurchase",
    paymentMethod: "Cash",
    amountToman: basic.priceToman,
    note: null,
    createdAtUtc: daysFromNow(-4),
    memberCode: sara.code,
    memberFullName: sara.fullName,
    branchNameEn: "South Branch",
    branchNameFa: "شعبه جنوب",
    packageNameEn: basic.nameEn,
    packageNameFa: basic.nameFa,
  });

  // 3) Reza — VIP @ South, cash, FROZEN 2 days ago (used 5/12)
  const rezaVipId = uid();
  db.memberPackages.push({
    id: rezaVipId,
    memberId: reza.id,
    packageId: vip.id,
    branchId: south,
    packageKind: "Exercise",
    sessionsTotal: vip.sessionsCount,
    sessionsUsed: 5,
    startedAtUtc: daysFromNow(-20),
    expiresAtUtc: daysFromNow(-20 + vip.durationDays),
    status: "Frozen",
    pricePaidToman: vip.priceToman,
    memberCode: reza.code,
    memberFullName: reza.fullName,
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
    branchNameEn: "South Branch",
    branchNameFa: "شعبه جنوب",
    isExpired: false,
    freezes: [],
    refund: null,
  });
  db.receipts.push({
    id: uid(),
    memberId: reza.id,
    branchId: south,
    memberPackageId: rezaVipId,
    kind: "PackagePurchase",
    paymentMethod: "Cash",
    amountToman: vip.priceToman,
    note: null,
    createdAtUtc: daysFromNow(-20),
    memberCode: reza.code,
    memberFullName: reza.fullName,
    branchNameEn: "South Branch",
    branchNameFa: "شعبه جنوب",
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
  });

  // 4) Maryam — VIP @ North, cash, Active (used 3/12)
  const maryamVipId = uid();
  db.memberPackages.push({
    id: maryamVipId,
    memberId: maryam.id,
    packageId: vip.id,
    branchId: north,
    packageKind: "Exercise",
    sessionsTotal: vip.sessionsCount,
    sessionsUsed: 3,
    startedAtUtc: daysFromNow(-10),
    expiresAtUtc: daysFromNow(-10 + vip.durationDays),
    status: "Active",
    pricePaidToman: vip.priceToman,
    memberCode: maryam.code,
    memberFullName: maryam.fullName,
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
    branchNameEn: "North Branch",
    branchNameFa: "شعبه شمال",
    isExpired: false,
    freezes: [],
    refund: null,
  });
  db.receipts.push({
    id: uid(),
    memberId: maryam.id,
    branchId: north,
    memberPackageId: maryamVipId,
    kind: "PackagePurchase",
    paymentMethod: "Cash",
    amountToman: vip.priceToman,
    note: null,
    createdAtUtc: daysFromNow(-10),
    memberCode: maryam.code,
    memberFullName: maryam.fullName,
    branchNameEn: "North Branch",
    branchNameFa: "شعبه شمال",
    packageNameEn: vip.nameEn,
    packageNameFa: vip.nameFa,
  });

  // 5) Ali — Basic @ South, cash, REFUNDED (pro-rata 5/8 = 750,000)
  const aliBasicId = uid();
  const refundAmount = Math.floor((basic.priceToman * (basic.sessionsCount - 3)) / basic.sessionsCount);
  db.memberPackages.push({
    id: aliBasicId,
    memberId: ali.id,
    packageId: basic.id,
    branchId: south,
    packageKind: "Exercise",
    sessionsTotal: basic.sessionsCount,
    sessionsUsed: 3,
    startedAtUtc: daysFromNow(-40),
    expiresAtUtc: daysFromNow(-40 + basic.durationDays),
    status: "Refunded",
    pricePaidToman: basic.priceToman,
    memberCode: ali.code,
    memberFullName: ali.fullName,
    packageNameEn: basic.nameEn,
    packageNameFa: basic.nameFa,
    branchNameEn: "South Branch",
    branchNameFa: "شعبه جنوب",
    isExpired: true,
    freezes: [],
    refund: null,
  });
  db.receipts.push(
    {
      id: uid(),
      memberId: ali.id,
      branchId: south,
      memberPackageId: aliBasicId,
      kind: "PackagePurchase",
      paymentMethod: "Cash",
      amountToman: basic.priceToman,
      note: null,
      createdAtUtc: daysFromNow(-40),
      memberCode: ali.code,
      memberFullName: ali.fullName,
      branchNameEn: "South Branch",
      branchNameFa: "شعبه جنوب",
      packageNameEn: basic.nameEn,
      packageNameFa: basic.nameFa,
    },
    {
      id: uid(),
      memberId: ali.id,
      branchId: south,
      memberPackageId: aliBasicId,
      kind: "PackageRefund",
      paymentMethod: "Cash",
      amountToman: refundAmount,
      note: "Member relocated (seed).",
      createdAtUtc: daysFromNow(-38),
      memberCode: ali.code,
      memberFullName: ali.fullName,
      branchNameEn: "South Branch",
      branchNameFa: "شعبه جنوب",
      packageNameEn: basic.nameEn,
      packageNameFa: basic.nameFa,
    },
  );

  // freeze + refund audit rows (queried via the package-detail endpoint)
  const rezaVip = db.memberPackages.find((mp) => mp.id === rezaVipId)!;
  rezaVip.freezes = [{ id: uid(), frozenAtUtc: daysFromNow(-2), unfrozenAtUtc: null, frozenDays: null }];
  rezaVip.refund = null;
  const aliBasic = db.memberPackages.find((mp) => mp.id === aliBasicId)!;
  aliBasic.freezes = [];
  aliBasic.refund = {
    id: uid(),
    amountToman: refundAmount,
    reason: "Member relocated (seed).",
    refundedAtUtc: daysFromNow(-38),
  };

  // ---------------------------------------------------------------- v2 — private coach packages (CASH — wallet ledger stays exactly as before)
  // SessionsUsed mirrors the seeded training-record history (Ali 3 sessions, Maryam 2)
  // so the Coaching workspace's remaining-session counters reconcile from the first boot.
  const private30 = db.packages.find((p) => p.kind === "PrivateCoaching" && p.sessionsCount === 30);
  const private20 = db.packages.find((p) => p.kind === "PrivateCoaching" && p.sessionsCount === 20);

  if (private30) {
    const aliPrivateId = uid();
    db.memberPackages.push({
      id: aliPrivateId,
      memberId: ali.id,
      packageId: private30.id,
      branchId: north,
      packageKind: "PrivateCoaching",
      sessionsTotal: private30.sessionsCount,
      sessionsUsed: 3,
      startedAtUtc: daysFromNow(-25),
      expiresAtUtc: daysFromNow(-25 + private30.durationDays),
      status: "Active",
      pricePaidToman: private30.priceToman,
      memberCode: ali.code,
      memberFullName: ali.fullName,
      packageNameEn: private30.nameEn,
      packageNameFa: private30.nameFa,
      branchNameEn: "North Branch",
      branchNameFa: "شعبه شمال",
      isExpired: false,
      freezes: [],
      refund: null,
    });
    db.receipts.push({
      id: uid(),
      memberId: ali.id,
      branchId: north,
      memberPackageId: aliPrivateId,
      kind: "PackagePurchase",
      paymentMethod: "Cash",
      amountToman: private30.priceToman,
      note: "Private coaching package (seed).",
      createdAtUtc: daysFromNow(-25),
      memberCode: ali.code,
      memberFullName: ali.fullName,
      branchNameEn: "North Branch",
      branchNameFa: "شعبه شمال",
      packageNameEn: private30.nameEn,
      packageNameFa: private30.nameFa,
    });
  }

  if (private20) {
    const maryamPrivateId = uid();
    db.memberPackages.push({
      id: maryamPrivateId,
      memberId: maryam.id,
      packageId: private20.id,
      branchId: north,
      packageKind: "PrivateCoaching",
      sessionsTotal: private20.sessionsCount,
      sessionsUsed: 2,
      startedAtUtc: daysFromNow(-9),
      expiresAtUtc: daysFromNow(-9 + private20.durationDays),
      status: "Active",
      pricePaidToman: private20.priceToman,
      memberCode: maryam.code,
      memberFullName: maryam.fullName,
      packageNameEn: private20.nameEn,
      packageNameFa: private20.nameFa,
      branchNameEn: "North Branch",
      branchNameFa: "شعبه شمال",
      isExpired: false,
      freezes: [],
      refund: null,
    });
    db.receipts.push({
      id: uid(),
      memberId: maryam.id,
      branchId: north,
      memberPackageId: maryamPrivateId,
      kind: "PackagePurchase",
      paymentMethod: "Cash",
      amountToman: private20.priceToman,
      note: "Private coaching package (seed).",
      createdAtUtc: daysFromNow(-9),
      memberCode: maryam.code,
      memberFullName: maryam.fullName,
      branchNameEn: "North Branch",
      branchNameFa: "شعبه شمال",
      packageNameEn: private20.nameEn,
      packageNameFa: private20.nameFa,
    });
  }
}

// ---------------------------------------------------------------- Phase 6 demo seeds (mirror of CoachingSeeder)

function seedDemoCoaching(db: DemoDb): void {
  const north = db.branches.find((b) => b.nameEn === "North Branch")!.id;
  const south = db.branches.find((b) => b.nameEn === "South Branch")!.id;
  const coachNorth = db.users.find((u) => u.role === "coach" && u.username === "coach.north");
  const coachSouth = db.users.find((u) => u.role === "coach" && u.username === "coach.south");
  if (!coachNorth) return;

  const ali = db.members.find((m) => m.code === "M-00001");
  const sara = db.members.find((m) => m.code === "M-00002");
  const maryam = db.members.find((m) => m.code === "M-00004");
  if (!ali || !sara || !maryam) return;

  // 1. coach.north → Ali @ North (active)
  db.coachAssignments.push({
    id: uid(),
    coachId: coachNorth.id,
    memberId: ali.id,
    branchId: north,
    assignedAtUtc: daysFromNow(-21),
    releasedAtUtc: null,
    note: "Strength focus — 3 sessions / week.",
  });

  // 2. coach.north → Maryam @ North (active)
  db.coachAssignments.push({
    id: uid(),
    coachId: coachNorth.id,
    memberId: maryam.id,
    branchId: north,
    assignedAtUtc: daysFromNow(-10),
    releasedAtUtc: null,
    note: "Postpartum comeback — light intensity.",
  });

  // 3. coach.south → Sara @ South (released — history demo)
  if (coachSouth) {
    db.coachAssignments.push({
      id: uid(),
      coachId: coachSouth.id,
      memberId: sara.id,
      branchId: south,
      assignedAtUtc: daysFromNow(-30),
      releasedAtUtc: daysFromNow(-12),
      note: "Moved to the North site (seed).",
    });
  }

  // Plans: Ali's month-1 plan is archived by his month-2 plan (exactly one active per pair).
  const aliPlanV1Id = uid();
  const aliPlanV2Id = uid();
  db.trainingPlans.push(
    {
      id: aliPlanV1Id,
      coachId: coachNorth.id,
      memberId: ali.id,
      title: "Hypertrophy — Month 1",
      goal: "Add 2kg lean mass; fix squat depth.",
      content:
        "Mon — Upper push: bench 4×8, incline DB 3×10, dips 3×8.\nWed — Lower: squat 5×5 @ 80kg, RDL 3×10, calf raises 4×15.\nFri — Upper pull: rows 4×8, lat pulldown 3×10, face pulls 3×15.\nProgression: +2.5kg when all sets hit target reps.",
      isActive: false,
      archivedAtUtc: daysFromNow(-7),
      createdAtUtc: daysFromNow(-21),
    },
    {
      id: aliPlanV2Id,
      coachId: coachNorth.id,
      memberId: ali.id,
      title: "Hypertrophy — Month 2",
      goal: "Push squat to 90kg; add pull-up volume.",
      content:
        "Mon — Upper push: bench 5×5, OH press 3×8, dips 3×10.\nWed — Lower: squat 5×5 @ 85kg, front squat 3×8, hip thrust 3×10.\nFri — Upper pull: weighted pull-ups 5×5, rows 4×10, curls 3×12.\nProgression: linear +2.5kg/week on the big lifts.",
      isActive: true,
      archivedAtUtc: null,
      createdAtUtc: daysFromNow(-7),
    },
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: maryam.id,
      title: "Foundation — Mobility & Core",
      goal: "Rebuild core stability; pain-free full range.",
      content:
        "Tue — Mobility flow 20' + dead bug 3×10, bird dog 3×10.\nThu — Goblet squat 3×12, band rows 3×15, plank 3×30s.\nSat — Walk 30' + stretching.\nRule: stop before form breaks; no max loads this month.",
      isActive: true,
      archivedAtUtc: null,
      createdAtUtc: daysFromNow(-9),
    },
  );

  // Records: sessions the assigned members actually did (2 of them within the last 7 days for the KPI).
  db.trainingRecords.push(
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: ali.id,
      trainingPlanId: aliPlanV2Id,
      branchId: north,
      performedAtUtc: daysFromNow(-2),
      summary: "Lower — squat 5×5 @ 85kg (all clean), RDL 3×10 @ 70kg.",
      durationMinutes: 55,
      intensity: "High",
      note: null,
    },
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: ali.id,
      trainingPlanId: aliPlanV2Id,
      branchId: north,
      performedAtUtc: daysFromNow(-4),
      summary: "Upper pull — weighted pull-up 5×5 +10kg, rows 4×10.",
      durationMinutes: 50,
      intensity: "Medium",
      note: null,
    },
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: ali.id,
      trainingPlanId: aliPlanV1Id,
      branchId: north,
      performedAtUtc: daysFromNow(-9),
      summary: "Month 1 test day — squat 80kg 5×5, depth fixed.",
      durationMinutes: 60,
      intensity: "Medium",
      note: "Followed the archived month-1 plan.",
    },
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: maryam.id,
      trainingPlanId: db.trainingPlans.find((p) => p.memberId === maryam.id)?.id ?? null,
      branchId: north,
      performedAtUtc: daysFromNow(-1),
      summary: "Mobility + core — plank 3×30s, pain-free.",
      durationMinutes: 40,
      intensity: "Low",
      note: null,
    },
    {
      id: uid(),
      coachId: coachNorth.id,
      memberId: maryam.id,
      trainingPlanId: db.trainingPlans.find((p) => p.memberId === maryam.id)?.id ?? null,
      branchId: north,
      performedAtUtc: daysFromNow(-3),
      summary: "Goblet squat 3×12 @ 8kg, band rows 3×15.",
      durationMinutes: 35,
      intensity: "Low",
      note: null,
    },
  );
}

function seedDemoWallet(db: DemoDb): void {
  const south = db.branches.find((b) => b.nameEn === "South Branch")!;
  const sara = db.members.find((m) => m.code === "M-00002")!;
  const account = db.walletAccounts.find((a) => a.memberId === sara.id);
  if (!account) {
    return;
  }

  // A desk top-up from yesterday: ledger row + TopUp receipt, BalanceAfter exact.
  const amount = 2_000_000;
  const at = daysFromNow(-1);
  account.balanceToman += amount;
  const receiptId = uid();
  db.receipts.push({
    id: receiptId,
    memberId: sara.id,
    branchId: south.id,
    memberPackageId: null,
    kind: "TopUp",
    paymentMethod: "Cash",
    amountToman: amount,
    note: "Desk top-up (seed).",
    createdAtUtc: at,
    memberCode: sara.code,
    memberFullName: sara.fullName,
    branchNameEn: south.nameEn,
    branchNameFa: south.nameFa,
    packageNameEn: "—",
    packageNameFa: "—",
  });
  db.walletTransactions.push({
    id: uid(),
    walletAccountId: account.id,
    amountToman: amount,
    kind: "TopUp",
    balanceAfter: account.balanceToman,
    relatedReceiptId: receiptId,
    note: "Desk top-up (seed).",
    createdAtUtc: at,
  });
}

// ---------------------------------------------------------------- Phase 4 demo seeds (mirror of AttendanceSeeder)

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function seedDemoAttendance(db: DemoDb): void {
  const north = db.branches.find((b) => b.nameEn === "North Branch")!.id;
  const south = db.branches.find((b) => b.nameEn === "South Branch")!.id;
  const memberByCard = (card: string) => db.members.find((m) => m.cardCode === card)!;

  const ali = memberByCard("RF-0001");
  const sara = memberByCard("RF-0002");
  const maryam = memberByCard("RF-0004");

  // Active member packages (mirrors the backend resolving through the Sales contract).
  const usable = (memberId: string, branchId: string) =>
    db.memberPackages.find(
      (mp) =>
        mp.memberId === memberId &&
        mp.status === "Active" &&
        mp.expiresAtUtc > new Date().toISOString() &&
        mp.sessionsUsed < mp.sessionsTotal &&
        mp.branchId === branchId,
    );

  const maryamVip = usable(maryam.id, north);
  const saraBasic = usable(sara.id, south);
  const aliVip = usable(ali.id, north);
  const aliBasicSouth = db.memberPackages.find((mp) => mp.memberId === ali.id && mp.branchId === south);

  const toEntry = (
    member: Member,
    mp: DemoMemberPackageRecord,
    branchId: string,
    branchNameEn: string,
    branchNameFa: string,
    checkInAtUtc: string,
    checkOutAtUtc: string | null,
  ): DemoAttendanceRecord => {
    const endMs = checkOutAtUtc ? new Date(checkOutAtUtc).getTime() : Date.now();
    return {
      id: uid(),
      memberId: member.id,
      memberPackageId: mp.id,
      branchId,
      checkInAtUtc,
      checkOutAtUtc,
      durationMinutes: Math.max(0, Math.floor((endMs - new Date(checkInAtUtc).getTime()) / 60_000)),
      isPresent: checkOutAtUtc === null,
      memberCode: member.code,
      memberFullName: member.fullName,
      packageNameEn: mp.packageNameEn,
      packageNameFa: mp.packageNameFa,
      branchNameEn,
      branchNameFa,
      sessionsTotal: mp.sessionsTotal,
      sessionsUsed: mp.sessionsUsed,
      sessionsRemaining: Math.max(0, mp.sessionsTotal - mp.sessionsUsed),
    };
  };

  // 1) Maryam — IN THE GYM NOW @ North (open entry, 35 min)
  if (maryamVip) {
    db.attendance.push(toEntry(maryam, maryamVip, north, "North Branch", "شعبه شمال", minutesAgo(35), null));
  }

  // 2) Sara — IN THE GYM NOW @ South (open entry, 12 min)
  if (saraBasic) {
    db.attendance.push(toEntry(sara, saraBasic, south, "South Branch", "شعبه جنوب", minutesAgo(12), null));
  }

  // 3) Ali — visited yesterday @ North (closed)
  if (aliVip) {
    db.attendance.push(
      toEntry(ali, aliVip, north, "North Branch", "شعبه شمال", minutesAgo(26 * 60), minutesAgo(24 * 60)),
    );
  }

  // 4) Ali — visited 3 days ago @ South on Basic (closed)
  if (aliBasicSouth) {
    db.attendance.push(
      toEntry(ali, aliBasicSouth, south, "South Branch", "شعبه جنوب", minutesAgo(74 * 60), minutesAgo(72 * 60)),
    );
  }
}

// ---------------------------------------------------------------- Phase 7 demo seeds (mirror of BuffetSeeder)

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

function seedDemoBuffet(db: DemoDb): void {
  const north = db.branches.find((b) => b.nameEn === "North Branch")!.id;
  const south = db.branches.find((b) => b.nameEn === "South Branch")!.id;
  const memberByCode = (code: string) => db.members.find((m) => m.code === code)!;
  const productByName = (prefix: string) => db.products.find((p) => p.nameEn.startsWith(prefix))!;

  const water = productByName("Water");
  const proteinBar = productByName("Protein");
  const energy = productByName("Energy");
  const priceOf = (product: BuffetProduct, branchId: string) =>
    product.prices.find((p) => p.branchId === branchId)!.priceToman;

  // Wallet debit with a linked BuffetPurchase receipt — mirrors the endpoint orchestration.
  const placeOrder = (
    member: Member,
    branchId: string,
    paymentMethod: PaymentMethod,
    lines: Array<{ product: BuffetProduct; quantity: number }>,
    at: string,
    note: string,
  ): void => {
    const branch = db.branches.find((b) => b.id === branchId)!;
    const items = lines.map(({ product, quantity }) => {
      const unitPriceToman = priceOf(product, branchId);
      return {
        productId: product.id,
        nameEn: product.nameEn,
        nameFa: product.nameFa,
        quantity,
        unitPriceToman,
        lineTotalToman: unitPriceToman * quantity,
      };
    });
    const totalToman = items.reduce((sum, item) => sum + item.lineTotalToman, 0);

    const receiptId = uid();
    db.receipts.push({
      id: receiptId,
      memberId: member.id,
      branchId,
      memberPackageId: null, // buffet orders are not tied to any exercise package.
      kind: "BuffetPurchase",
      paymentMethod,
      amountToman: totalToman,
      note,
      createdAtUtc: at,
      memberCode: member.code,
      memberFullName: member.fullName,
      branchNameEn: branch.nameEn,
      branchNameFa: branch.nameFa,
      packageNameEn: "—",
      packageNameFa: "—",
    });

    if (paymentMethod === "Wallet") {
      const account = db.walletAccounts.find((a) => a.memberId === member.id);
      if (!account) throw new Error(`Seed error: no wallet account for ${member.code}`);
      if (account.balanceToman < totalToman) throw new Error("Seed error: insufficient wallet balance");
      account.balanceToman -= totalToman;
      db.walletTransactions.push({
        id: uid(),
        walletAccountId: account.id,
        amountToman: -totalToman,
        kind: "BuffetPurchase",
        balanceAfter: account.balanceToman,
        relatedReceiptId: receiptId,
        note,
        createdAtUtc: at,
      });
    }

    db.buffetOrders.push({
      id: uid(),
      memberId: member.id,
      branchId,
      paymentMethod,
      totalToman,
      receiptId,
      note,
      createdAtUtc: at,
      items,
    });
  };

  // 1) Ali — wallet @ North, yesterday: 2× water + 1× protein bar = 115,000 T.
  placeOrder(memberByCode("M-00001"), north, "Wallet", [{ product: water, quantity: 2 }, { product: proteinBar, quantity: 1 }],
    daysFromNow(-1), "Buffet order (seed).");

  // 2) Sara — cash @ South, ~90 minutes ago: 1× energy drink + 1× protein bar = 155,000 T.
  placeOrder(memberByCode("M-00002"), south, "Cash", [{ product: energy, quantity: 1 }, { product: proteinBar, quantity: 1 }],
    minutesFromNow(-90), "Buffet order (seed).");

  // 3) Maryam — wallet @ North, 2 hours ago: 1× water = 15,000 T.
  placeOrder(memberByCode("M-00004"), north, "Wallet", [{ product: water, quantity: 1 }],
    minutesFromNow(-120), "Buffet order (seed).");
}

export function loadDb(): DemoDb {
  if (typeof window === "undefined") throw new Error("demo store requires a browser");
  const raw = window.localStorage.getItem(DB_KEY);
  if (!raw) {
    const db = seedDb();
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
  try {
    return JSON.parse(raw) as DemoDb;
  } catch {
    const db = seedDb();
    window.localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }
}

export function saveDb(db: DemoDb): void {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDemoDb(): void {
  window.localStorage.removeItem(DB_KEY);
  window.localStorage.removeItem("gms.session");
}

export const wait = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- errors (ProblemDetails-like)

export class GmsApiError extends Error {
  status: number;
  errorCode: string;
  fieldErrors: Record<string, string[]>;

  constructor(status: number, errorCode: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors ?? {};
  }
}

// ---------------------------------------------------------------- identity

export async function demoLogin(username: string, password: string): Promise<LoginResponse> {
  await wait();
  const db = loadDb();
  const user = db.users.find((u) => u.username === username.trim().toLowerCase());
  if (!user || user.password !== password) {
    throw new GmsApiError(401, "identity.invalid_credentials", "Invalid username or password.");
  }
  if (!user.isActive) {
    throw new GmsApiError(403, "identity.user_inactive", "This account has been deactivated.");
  }
  return {
    accessToken: `demo.${btoa(unescape(encodeURIComponent(user.id)))}.${Date.now() + SESSION_TTL_MS}.sig`,
    expiresInSeconds: SESSION_TTL_MS / 1000,
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, branchId: user.branchId ?? null },
  };
}

// ---------------------------------------------------------------- identity — user admin (v2.1)

/** Decodes the acting user's id from the localStorage demo session token (guards rely on it). */
function readSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("gms.session");
    if (!raw) return null;
    const session = JSON.parse(raw) as { token: string; expiresAt: number };
    if (session.expiresAt <= Date.now()) return null;
    const payload = session.token.split(".")[1];
    return payload ? decodeURIComponent(escape(atob(payload))) : null;
  } catch {
    return null;
  }
}

const toSystemUser = (u: DemoUser): SystemUser => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  branchId: u.branchId ?? null,
  isActive: u.isActive,
  createdAtUtc: new Date().toISOString(),
});

export async function demoListUsers(): Promise<SystemUser[]> {
  await wait(140);
  return loadDb().users.map(toSystemUser);
}

/** Mirrors POST /identity/users validation 1:1 (UserAdminRules). */
export async function demoCreateUser(req: CreateUserRequest): Promise<SystemUser> {
  await wait(260);
  const db = loadDb();

  const errors: Record<string, string[]> = {};
  const username = req.username?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(username) || username.length < 3 || username.length > 64) {
    errors.username = ["Must be 3-64 characters; lowercase letters, digits, dot, dash, underscore only."];
  }
  if (!req.password || req.password.length < 8 || req.password.length > 128) {
    errors.password = ["Must be 8-128 characters."];
  }
  if (!req.displayName?.trim() || req.displayName.trim().length > 128) {
    errors.displayName = ["Required, max 128 characters."];
  }
  if (!["admin", "reception", "buffet", "coach"].includes(req.role)) {
    errors.role = ["Must be one of: admin, reception, buffet, coach."];
  }
  if (req.branchId && !db.branches.some((b) => b.id === req.branchId && b.isActive)) {
    errors.branchId = ["Unknown or inactive branch."];
  }
  if (Object.keys(errors).length === 0 && db.users.some((u) => u.username === username)) {
    throw new GmsApiError(409, "identity.username.duplicate", "This username is already taken.");
  }
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  const user: DemoUser = {
    id: uid(),
    username,
    password: req.password,
    displayName: req.displayName.trim(),
    role: req.role,
    branchId: req.branchId ?? null,
    isActive: req.isActive ?? true,
  };
  db.users.push(user);
  saveDb(db);
  return toSystemUser(user);
}

/** Mirrors POST /identity/users/{id}/status — self + last-active-admin deactivation guards. */
export async function demoSetUserStatus(id: string, isActive: boolean): Promise<SystemUser> {
  await wait(220);
  const db = loadDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new GmsApiError(404, "identity.user.not_found", "User not found.");

  if (!isActive) {
    const sessionId = readSessionUserId();
    if (sessionId && sessionId === user.id) {
      throw new GmsApiError(409, "identity.user.self_deactivate", "You cannot deactivate your own account.");
    }
    if (user.role === "admin" && user.isActive) {
      const activeAdmins = db.users.filter((u) => u.isActive && u.role === "admin").length;
      if (activeAdmins <= 1) {
        throw new GmsApiError(409, "identity.user.last_admin", "At least one active admin must remain.");
      }
    }
  }

  user.isActive = isActive;
  saveDb(db);
  return toSystemUser(user);
}

/** Mirrors POST /identity/users/{id}/password. */
export async function demoResetUserPassword(id: string, newPassword: string): Promise<SystemUser> {
  await wait(240);
  const db = loadDb();
  const user = db.users.find((u) => u.id === id);
  if (!user) throw new GmsApiError(404, "identity.user.not_found", "User not found.");
  if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
    throw new GmsApiError(
      400,
      "validation.failed",
      "One or more validation errors occurred.",
      { newPassword: ["Must be 8-128 characters."] },
    );
  }
  user.password = newPassword;
  saveDb(db);
  return toSystemUser(user);
}

// ---------------------------------------------------------------- branches / catalog

export async function demoListBranches(): Promise<Branch[]> {
  await wait(120);
  return loadDb().branches.filter((b) => b.isActive);
}

export async function demoListPackages(): Promise<ExercisePackage[]> {
  await wait(140);
  return loadDb().packages;
}

/** v2 — admin package creation; mirrors POST /catalog/packages validation exactly. */
export async function demoCreatePackage(req: CreatePackageRequest): Promise<ExercisePackage> {
  await wait(260);
  const db = loadDb();

  const errors: Record<string, string[]> = {};
  if (!req.nameEn?.trim() || req.nameEn.trim().length > 128) {
    errors.nameEn = ["Required, max 128 characters."];
  }
  if (!req.nameFa?.trim() || req.nameFa.trim().length > 128) {
    errors.nameFa = ["Required, max 128 characters."];
  }
  if (!Number.isInteger(req.sessionsCount) || req.sessionsCount < 1 || req.sessionsCount > 1000) {
    errors.sessionsCount = ["Must be between 1 and 1000."];
  }
  if (!Number.isInteger(req.durationDays) || req.durationDays < 1 || req.durationDays > 3650) {
    errors.durationDays = ["Must be between 1 and 3650."];
  }
  if (!Number.isInteger(req.priceToman) || req.priceToman <= 0) {
    errors.priceToman = ["Must be a positive integer amount of Toman."];
  }
  if (!Array.isArray(req.branchIds) || req.branchIds.length === 0) {
    errors.branchIds = ["At least one branch must be granted."];
  }
  const distinctBranchIds = [...new Set(req.branchIds ?? [])];
  for (const branchId of distinctBranchIds) {
    if (!db.branches.some((b) => b.id === branchId && b.isActive)) {
      errors[`branchIds[${branchId}]`] = ["Unknown or inactive branch."];
    }
  }
  if (req.kind !== "Exercise" && req.kind !== "PrivateCoaching") {
    errors.kind = ["Exercise or PrivateCoaching are the only accepted values."];
  }
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  const pkg: ExercisePackage = {
    id: uid(),
    nameEn: req.nameEn.trim(),
    nameFa: req.nameFa.trim(),
    kind: req.kind,
    sessionsCount: req.sessionsCount,
    durationDays: req.durationDays,
    priceToman: req.priceToman,
    isActive: req.isActive ?? true,
    branchIds: distinctBranchIds,
  };
  db.packages.push(pkg);
  saveDb(db);
  return pkg;
}

export async function demoListProducts(branchId?: string): Promise<BuffetProduct[]> {
  await wait(140);
  const products = loadDb().products;
  return branchId ? products.filter((p) => p.prices.some((pr) => pr.branchId === branchId)) : products;
}

// ---------------------------------------------------------------- members (Phase 2)

function nextMemberCode(members: Member[]): string {
  const max = members.reduce((acc, m) => {
    const suffix = m.code.startsWith("M-") ? Number.parseInt(m.code.slice(2), 10) : Number.NaN;
    return Number.isFinite(suffix) && suffix > acc ? suffix : acc;
  }, 0);
  return `M-${String(max + 1).padStart(5, "0")}`;
}

function duplicateFieldErrors(db: DemoDb, phone: string | null | undefined, card: string | null | undefined, excludeId?: string) {
  const errors: Record<string, string[]> = {};
  if (phone && db.members.some((m) => m.phoneNumber === phone && m.id !== excludeId)) {
    errors.phoneNumber = [`Phone number ${phone} is already registered to another member.`];
  }
  if (card && db.members.some((m) => m.cardCode === card && m.id !== excludeId)) {
    errors.cardCode = [`Card ${card} is already assigned to another member.`];
  }
  return errors;
}

export async function demoSearchMembers(query: MemberQuery): Promise<PagedResult<Member>> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;

  const term = query.search?.trim().toLowerCase() ?? "";
  let items = [...db.members];

  if (term) {
    items = items.filter(
      (m) =>
        m.fullName.toLowerCase().includes(term) ||
        m.code.toLowerCase().includes(term) ||
        (m.phoneNumber ?? "").includes(term) ||
        (m.cardCode ?? "").toLowerCase().includes(term),
    );
  }
  if (query.status) {
    items = items.filter((m) => m.status === query.status);
  }
  if (query.branchId) {
    items = items.filter((m) => m.homeBranchId === query.branchId);
  }

  items.sort((a, b) => (a.joinDateUtc < b.joinDateUtc ? 1 : -1));
  const totalCount = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize);
  return { items: paged, page, pageSize, totalCount };
}

export async function demoGetMember(id: string): Promise<Member> {
  await wait(120);
  const member = loadDb().members.find((m) => m.id === id);
  if (!member) throw new GmsApiError(404, "member.not_found", "Member not found.");
  return member;
}

export async function demoCreateMember(model: MemberWriteModel): Promise<Member> {
  await wait(260);
  const db = loadDb();

  const errors: Record<string, string[]> = {};
  if (!model.fullName.trim()) errors.fullName = ["Full name is required."];
  if (!model.homeBranchId || !db.branches.some((b) => b.id === model.homeBranchId && b.isActive)) {
    errors.homeBranchId = ["Unknown or inactive branch."];
  }
  Object.assign(errors, duplicateFieldErrors(db, model.phoneNumber?.trim() || null, model.cardCode?.trim() || null));
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  const member: Member = {
    id: uid(),
    code: nextMemberCode(db.members),
    fullName: model.fullName.trim(),
    phoneNumber: model.phoneNumber?.trim() || null,
    gender: model.gender ?? "Unknown",
    birthDateUtc: model.birthDate ? new Date(model.birthDate).toISOString() : null,
    joinDateUtc: new Date().toISOString(),
    homeBranchId: model.homeBranchId,
    cardCode: model.cardCode?.trim() || null,
    status: "Active",
    notes: model.notes?.trim() || null,
  };
  db.members.push(member);
  saveDb(db);
  return member;
}

export async function demoUpdateMember(id: string, model: MemberWriteModel): Promise<Member> {
  await wait(260);
  const db = loadDb();
  const member = db.members.find((m) => m.id === id);
  if (!member) throw new GmsApiError(404, "member.not_found", "Member not found.");

  const errors: Record<string, string[]> = {};
  if (!model.fullName.trim()) errors.fullName = ["Full name is required."];
  if (!model.homeBranchId || !db.branches.some((b) => b.id === model.homeBranchId && b.isActive)) {
    errors.homeBranchId = ["Unknown or inactive branch."];
  }
  Object.assign(
    errors,
    duplicateFieldErrors(db, model.phoneNumber?.trim() || null, model.cardCode?.trim() || null, id),
  );
  if (Object.keys(errors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", errors);
  }

  member.fullName = model.fullName.trim();
  member.phoneNumber = model.phoneNumber?.trim() || null;
  member.gender = model.gender ?? "Unknown";
  member.birthDateUtc = model.birthDate ? new Date(model.birthDate).toISOString() : null;
  member.homeBranchId = model.homeBranchId;
  member.cardCode = model.cardCode?.trim() || null;
  member.notes = model.notes?.trim() || null;
  saveDb(db);
  return member;
}

export async function demoSetMemberStatus(id: string, status: MemberStatus): Promise<Member> {
  await wait(180);
  const db = loadDb();
  const member = db.members.find((m) => m.id === id);
  if (!member) throw new GmsApiError(404, "member.not_found", "Member not found.");
  member.status = status;
  saveDb(db);
  return member;
}
