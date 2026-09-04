// Demo adapter — implements the same contract as the .NET API so the sandbox preview
// is fully interactive without a running backend. State persists in localStorage.
// It mirrors backend seeds (Phase 1) and member endpoints (Phase 2).

import type {
  Branch,
  BuffetProduct,
  ExercisePackage,
  LoginResponse,
  Member,
  MemberQuery,
  MemberStatus,
  MemberWriteModel,
  PagedResult,
} from "./types";

const DB_KEY = "gms.demo.db.v2";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface DemoUser {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "reception" | "buffet" | "coach";
  branchId?: string | null;
}

interface DemoDb {
  seededAt: string;
  users: DemoUser[];
  branches: Branch[];
  packages: ExercisePackage[];
  products: BuffetProduct[];
  members: Member[];
}

const uid = () =>
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

  return {
    seededAt: now,
    users: [
      { id: uid(), username: "admin", password: "Admin@123", displayName: "مدیر سیستم", role: "admin", branchId: null },
      { id: uid(), username: "reception.north", password: "Operator@123", displayName: "پذیرش — شعبه شمال", role: "reception", branchId: northId },
      { id: uid(), username: "reception.south", password: "Operator@123", displayName: "پذیرش — شعبه جنوب", role: "reception", branchId: southId },
      { id: uid(), username: "buffet.north", password: "Operator@123", displayName: "بوفه — شعبه شمال", role: "buffet", branchId: northId },
      { id: uid(), username: "coach.north", password: "Operator@123", displayName: "مربی — شعبه شمال", role: "coach", branchId: northId },
    ],
    branches: [
      { id: northId, nameEn: "North Branch", nameFa: "شعبه شمال", city: "تهران", phoneNumber: "021-22000001", isActive: true },
      { id: southId, nameEn: "South Branch", nameFa: "شعبه جنوب", city: "تهران", phoneNumber: "021-22000002", isActive: true },
    ],
    packages: [
      {
        id: uid(),
        nameEn: "VIP — 12 Sessions / 1 Month",
        nameFa: "ویژه — ۱۲ جلسه / یک ماه",
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
        sessionsCount: 8,
        durationDays: 14,
        priceToman: 1_200_000,
        isActive: true,
        branchIds: [southId],
      },
    ],
    products: [
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
    ],
    members,
  };
}

function loadDb(): DemoDb {
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

function saveDb(db: DemoDb): void {
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

export function resetDemoDb(): void {
  window.localStorage.removeItem(DB_KEY);
  window.localStorage.removeItem("gms.session");
}

const wait = (ms = 220) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  return {
    accessToken: `demo.${btoa(unescape(encodeURIComponent(user.id)))}.${Date.now() + SESSION_TTL_MS}.sig`,
    expiresInSeconds: SESSION_TTL_MS / 1000,
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, branchId: user.branchId ?? null },
  };
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
