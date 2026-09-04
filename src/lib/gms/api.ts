// Unified GMS API client.
// - If NEXT_PUBLIC_GMS_API_BASE is set, calls the real ASP.NET Core backend (/api/v1).
// - Otherwise falls back to the in-browser demo adapter (same contract).

import {
  GmsApiError,
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

export { GmsApiError };
