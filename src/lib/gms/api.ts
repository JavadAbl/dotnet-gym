// Unified GMS API client.
// - If NEXT_PUBLIC_GMS_API_BASE is set, calls the real ASP.NET Core backend (/api/v1).
// - Otherwise falls back to the in-browser demo adapter (same contract).

import {
  demoCheckIn,
  demoCheckOut,
  demoPresence,
  demoSearchAttendance,
} from "./demo-attendance";
import {
  demoCreateMember,
  demoGetMember,
  demoListBranches,
  demoListPackages,
  demoListProducts,
  demoLogin,
  demoSearchMembers,
  demoSetMemberStatus,
  demoUpdateMember,
} from "./demo-store";
import {
  demoFreezeMemberPackage,
  demoGetMemberPackage,
  demoGetWalletSnapshot,
  demoListReceipts,
  demoPurchaseMemberPackage,
  demoRefundMemberPackage,
  demoSearchMemberPackages,
  demoUnfreezeMemberPackage,
} from "./demo-sales";
import { GmsApiError } from "./demo-store";
import {
  demoListWalletAccounts,
  demoListWalletTransactions,
  demoTopUp,
} from "./demo-wallet";
import {
  demoArchiveTrainingPlan,
  demoCoachingSummary,
  demoCreateAssignment,
  demoCreateTrainingPlan,
  demoCreateTrainingRecord,
  demoListCoachAssignments,
  demoListCoaches,
  demoListTrainingPlans,
  demoListTrainingRecords,
  demoReleaseAssignment,
} from "./demo-coaching";
import {
  demoCreateBuffetOrder,
  demoCreateProduct,
  demoGetBuffetSummary,
  demoSearchBuffetOrders,
  demoUpdateProduct,
} from "./demo-buffet";
import type {
  AttendanceEntry,
  AttendanceQuery,
  Branch,
  BuffetOrder,
  BuffetOrderQuery,
  BuffetProduct,
  BuffetSummary,
  CheckInRequest,
  CoachAssignment,
  CoachAssignmentQuery,
  CoachListResponse,
  CoachingSummary,
  CreateAssignmentRequest,
  CreateBuffetOrderRequest,
  CreatePlanRequest,
  CreateProductRequest,
  CreateRecordRequest,
  ExercisePackage,
  LoginResponse,
  Member,
  MemberPackage,
  MemberPackageDetail,
  MemberPackageQuery,
  MemberQuery,
  MemberStatus,
  MemberWriteModel,
  PagedResult,
  PresenceBoard,
  PurchaseRequest,
  Receipt,
  RefundRequest,
  TopUpRequest,
  TopUpResponse,
  TrainingPlan,
  TrainingPlanQuery,
  TrainingRecord,
  TrainingRecordQuery,
  UpdateProductRequest,
  WalletAccountsPage,
  WalletAccountsQuery,
  WalletSnapshot,
  WalletTransaction,
  WalletTransactionsQuery,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_GMS_API_BASE;

export const isDemoMode = !API_BASE;

const SESSION_KEY = "gms.session";

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { token: string; expiresAt: number };
    return session.expiresAt > Date.now() ? session.token : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new GmsApiError(0, "client.config", "API base URL is not configured.");
  const token = readToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  // ProblemDetails: { type, title, status, detail, errorCode, errors }
  let errorCode = "http.error";
  let message = `Request failed with status ${response.status}.`;
  let fieldErrors: Record<string, string[]> | undefined;
  try {
    const problem = (await response.json()) as {
      title?: string;
      detail?: string;
      errorCode?: string;
      errors?: Record<string, string[]>;
    };
    errorCode = problem.errorCode ?? problem.title ?? errorCode;
    message = problem.detail ?? problem.title ?? message;
    fieldErrors = problem.errors;
  } catch {
    // non-JSON error body — keep defaults
  }
  throw new GmsApiError(response.status, errorCode, message, fieldErrors);
}

// ---------------------------------------------------------------- identity

export async function login(username: string, password: string): Promise<LoginResponse> {
  if (isDemoMode) return demoLogin(username, password);
  return request<LoginResponse>("/identity/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// ---------------------------------------------------------------- branches / catalog

export function listBranches(): Promise<Branch[]> {
  if (isDemoMode) return demoListBranches();
  return request<Branch[]>("/branches");
}

export function listPackages(): Promise<ExercisePackage[]> {
  if (isDemoMode) return demoListPackages();
  return request<ExercisePackage[]>("/catalog/packages");
}

export function listProducts(branchId?: string): Promise<BuffetProduct[]> {
  if (isDemoMode) return demoListProducts(branchId);
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return request<BuffetProduct[]>(`/catalog/products${query}`);
}

// ---------------------------------------------------------------- members (Phase 2)

export function searchMembers(query: MemberQuery): Promise<PagedResult<Member>> {
  if (isDemoMode) return demoSearchMembers(query);
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.branchId) params.set("branchId", query.branchId);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return request<PagedResult<Member>>(`/members?${params.toString()}`);
}

export function getMember(id: string): Promise<Member> {
  if (isDemoMode) return demoGetMember(id);
  return request<Member>(`/members/${id}`);
}

export function createMember(model: MemberWriteModel): Promise<Member> {
  if (isDemoMode) return demoCreateMember(model);
  return request<Member>("/members", { method: "POST", body: JSON.stringify(model) });
}

export function updateMember(id: string, model: MemberWriteModel): Promise<Member> {
  if (isDemoMode) return demoUpdateMember(id, model);
  return request<Member>(`/members/${id}`, { method: "PUT", body: JSON.stringify(model) });
}

export function setMemberStatus(id: string, status: MemberStatus): Promise<Member> {
  if (isDemoMode) return demoSetMemberStatus(id, status);
  return request<Member>(`/members/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

// ---------------------------------------------------------------- sales (Phase 3)

export function searchMemberPackages(query: MemberPackageQuery): Promise<PagedResult<MemberPackage>> {
  if (isDemoMode) return demoSearchMemberPackages(query);
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  return request<PagedResult<MemberPackage>>(`/sales/member-packages?${params.toString()}`);
}

export function getMemberPackage(id: string): Promise<MemberPackageDetail> {
  if (isDemoMode) return demoGetMemberPackage(id);
  return request<MemberPackageDetail>(`/sales/member-packages/${id}`);
}

export function purchaseMemberPackage(req: PurchaseRequest): Promise<MemberPackage> {
  if (isDemoMode) return demoPurchaseMemberPackage(req);
  return request<MemberPackage>("/sales/member-packages", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function freezeMemberPackage(id: string): Promise<MemberPackageDetail> {
  if (isDemoMode) return demoFreezeMemberPackage(id);
  return request<MemberPackageDetail>(`/sales/member-packages/${id}/freeze`, { method: "POST" });
}

export function unfreezeMemberPackage(id: string): Promise<MemberPackageDetail> {
  if (isDemoMode) return demoUnfreezeMemberPackage(id);
  return request<MemberPackageDetail>(`/sales/member-packages/${id}/unfreeze`, { method: "POST" });
}

export function refundMemberPackage(id: string, req: RefundRequest): Promise<MemberPackageDetail> {
  if (isDemoMode) return demoRefundMemberPackage(id, req);
  return request<MemberPackageDetail>(`/sales/member-packages/${id}/refund`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function listReceipts(query: {
  memberId?: string;
  branchId?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<Receipt>> {
  if (isDemoMode) return demoListReceipts(query);
  const params = new URLSearchParams();
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.kind) params.set("kind", query.kind);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  return request<PagedResult<Receipt>>(`/sales/receipts?${params.toString()}`);
}

// ---------------------------------------------------------------- attendance (Phase 4)

export function checkIn(req: CheckInRequest): Promise<AttendanceEntry> {
  if (isDemoMode) return demoCheckIn(req);
  return request<AttendanceEntry>("/attendance/check-in", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function checkOut(entryId: string): Promise<AttendanceEntry> {
  if (isDemoMode) return demoCheckOut(entryId);
  return request<AttendanceEntry>(`/attendance/entries/${entryId}/check-out`, { method: "POST" });
}

export function getPresence(branchId?: string): Promise<PresenceBoard> {
  if (isDemoMode) return demoPresence(branchId);
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return request<PresenceBoard>(`/attendance/presence${query}`);
}

export function searchAttendance(query: AttendanceQuery): Promise<PagedResult<AttendanceEntry>> {
  if (isDemoMode) return demoSearchAttendance(query);
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return request<PagedResult<AttendanceEntry>>(`/attendance?${params.toString()}`);
}

// ---------------------------------------------------------------- wallet (Phase 5)

export function getWalletSnapshot(memberId: string): Promise<WalletSnapshot> {
  if (isDemoMode) return demoGetWalletSnapshot(memberId);
  return request<WalletSnapshot>(`/wallet/members/${memberId}`);
}

export function listWalletAccounts(query: WalletAccountsQuery): Promise<WalletAccountsPage> {
  if (isDemoMode) return demoListWalletAccounts(query);
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  return request<WalletAccountsPage>(`/wallet/accounts?${params.toString()}`);
}

export function listWalletTransactions(
  memberId: string,
  query: WalletTransactionsQuery,
): Promise<PagedResult<WalletTransaction>> {
  if (isDemoMode) return demoListWalletTransactions(memberId, query);
  const params = new URLSearchParams();
  if (query.kind) params.set("kind", query.kind);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  return request<PagedResult<WalletTransaction>>(`/wallet/members/${memberId}/transactions?${params.toString()}`);
}

export function topUpWallet(memberId: string, req: TopUpRequest): Promise<TopUpResponse> {
  if (isDemoMode) return demoTopUp(memberId, req);
  return request<TopUpResponse>(`/wallet/members/${memberId}/top-up`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ---------------------------------------------------------------- coaching (Phase 6)

export function listCoaches(): Promise<CoachListResponse> {
  if (isDemoMode) return demoListCoaches();
  return request<CoachListResponse>("/coaching/coaches");
}

export function searchCoachAssignments(query: CoachAssignmentQuery): Promise<PagedResult<CoachAssignment>> {
  if (isDemoMode) return demoListCoachAssignments(query);
  const params = new URLSearchParams();
  if (query.coachId) params.set("coachId", query.coachId);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return request<PagedResult<CoachAssignment>>(`/coaching/assignments?${params.toString()}`);
}

export function createCoachAssignment(req: CreateAssignmentRequest): Promise<CoachAssignment> {
  if (isDemoMode) return demoCreateAssignment(req);
  return request<CoachAssignment>("/coaching/assignments", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function releaseCoachAssignment(assignmentId: string): Promise<CoachAssignment> {
  if (isDemoMode) return demoReleaseAssignment(assignmentId);
  return request<CoachAssignment>(`/coaching/assignments/${assignmentId}/release`, { method: "POST" });
}

export function searchTrainingPlans(query: TrainingPlanQuery): Promise<PagedResult<TrainingPlan>> {
  if (isDemoMode) return demoListTrainingPlans(query);
  const params = new URLSearchParams();
  if (query.coachId) params.set("coachId", query.coachId);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.activeOnly) params.set("activeOnly", "true");
  if (query.search) params.set("search", query.search);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return request<PagedResult<TrainingPlan>>(`/coaching/plans?${params.toString()}`);
}

export function createTrainingPlan(req: CreatePlanRequest): Promise<TrainingPlan> {
  if (isDemoMode) return demoCreateTrainingPlan(req);
  return request<TrainingPlan>("/coaching/plans", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function archiveTrainingPlan(planId: string): Promise<TrainingPlan> {
  if (isDemoMode) return demoArchiveTrainingPlan(planId);
  return request<TrainingPlan>(`/coaching/plans/${planId}/archive`, { method: "POST" });
}

export function searchTrainingRecords(query: TrainingRecordQuery): Promise<PagedResult<TrainingRecord>> {
  if (isDemoMode) return demoListTrainingRecords(query);
  const params = new URLSearchParams();
  if (query.coachId) params.set("coachId", query.coachId);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.search) params.set("search", query.search);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 20));
  return request<PagedResult<TrainingRecord>>(`/coaching/records?${params.toString()}`);
}

export function createTrainingRecord(req: CreateRecordRequest): Promise<TrainingRecord> {
  if (isDemoMode) return demoCreateTrainingRecord(req);
  return request<TrainingRecord>("/coaching/records", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function getCoachingSummary(coachId?: string): Promise<CoachingSummary> {
  if (isDemoMode) return demoCoachingSummary(coachId);
  const query = coachId ? `?coachId=${encodeURIComponent(coachId)}` : "";
  return request<CoachingSummary>(`/coaching/summary${query}`);
}

// ---------------------------------------------------------------- buffet (Phase 7)

export function createBuffetOrder(req: CreateBuffetOrderRequest): Promise<BuffetOrder> {
  if (isDemoMode) return demoCreateBuffetOrder(req);
  return request<BuffetOrder>("/buffet/orders", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function searchBuffetOrders(query: BuffetOrderQuery): Promise<PagedResult<BuffetOrder>> {
  if (isDemoMode) return demoSearchBuffetOrders(query);
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.memberId) params.set("memberId", query.memberId);
  if (query.branchId) params.set("branchId", query.branchId);
  if (query.paymentMethod) params.set("paymentMethod", query.paymentMethod);
  params.set("page", String(query.page ?? 1));
  params.set("pageSize", String(query.pageSize ?? 10));
  return request<PagedResult<BuffetOrder>>(`/buffet/orders?${params.toString()}`);
}

export function getBuffetSummary(branchId?: string): Promise<BuffetSummary> {
  if (isDemoMode) return demoGetBuffetSummary(branchId);
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return request<BuffetSummary>(`/buffet/summary${query}`);
}

export function createProduct(req: CreateProductRequest): Promise<BuffetProduct> {
  if (isDemoMode) return demoCreateProduct(req);
  return request<BuffetProduct>("/catalog/products", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function updateProduct(id: string, req: UpdateProductRequest): Promise<BuffetProduct> {
  if (isDemoMode) return demoUpdateProduct(id, req);
  return request<BuffetProduct>(`/catalog/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export { GmsApiError };
