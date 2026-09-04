// DTO types mirroring the GMS ASP.NET Core API contract (camelCase JSON).

export type Role = "admin" | "reception" | "buffet" | "coach";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  branchId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

export interface Branch {
  id: string;
  nameEn: string;
  nameFa: string;
  city?: string | null;
  phoneNumber?: string | null;
  isActive: boolean;
}

export interface ExercisePackage {
  id: string;
  nameEn: string;
  nameFa: string;
  sessionsCount: number;
  durationDays: number;
  priceToman: number;
  isActive: boolean;
  branchIds: string[];
}

export interface BuffetProductPrice {
  branchId: string;
  priceToman: number;
}

export interface BuffetProduct {
  id: string;
  nameEn: string;
  nameFa: string;
  isActive: boolean;
  prices: BuffetProductPrice[];
}

export type MemberStatus = "Active" | "Inactive" | "Blocked";
export type Gender = "Unknown" | "Male" | "Female";

export interface Member {
  id: string;
  code: string;
  fullName: string;
  phoneNumber?: string | null;
  gender: Gender;
  birthDateUtc?: string | null;
  joinDateUtc: string;
  homeBranchId: string;
  cardCode?: string | null;
  status: MemberStatus;
  notes?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface MemberQuery {
  search?: string;
  status?: MemberStatus | "";
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export interface MemberWriteModel {
  fullName: string;
  phoneNumber?: string | null;
  gender?: Gender;
  birthDate?: string | null; // ISO date
  homeBranchId: string;
  cardCode?: string | null;
  notes?: string | null;
}

export interface Session {
  token: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
}
