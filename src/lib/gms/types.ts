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

// ---------------------------------------------------------------- sales (Phase 3)

export type MemberPackageStatus = "Active" | "Frozen" | "Refunded";
export type PaymentMethod = "Cash" | "Wallet";
export type ReceiptKind = "PackagePurchase" | "PackageRefund";

export interface MemberPackage {
  id: string;
  memberId: string;
  packageId: string;
  branchId: string;
  sessionsTotal: number;
  sessionsUsed: number;
  startedAtUtc: string;
  expiresAtUtc: string;
  status: MemberPackageStatus;
  pricePaidToman: number;
  // enrichment resolved by the API / demo adapter
  memberCode: string;
  memberFullName: string;
  packageNameEn: string;
  packageNameFa: string;
  branchNameEn: string;
  branchNameFa: string;
  isExpired: boolean;
}

export interface PackageFreeze {
  id: string;
  frozenAtUtc: string;
  unfrozenAtUtc?: string | null;
  frozenDays?: number | null;
}

export interface PackageRefund {
  id: string;
  amountToman: number;
  reason?: string | null;
  refundedAtUtc: string;
}

export interface Receipt {
  id: string;
  memberId: string;
  branchId: string;
  memberPackageId: string;
  kind: ReceiptKind;
  paymentMethod: PaymentMethod;
  amountToman: number;
  note?: string | null;
  createdAtUtc: string;
  memberCode: string;
  memberFullName: string;
  branchNameEn: string;
  branchNameFa: string;
  packageNameEn: string;
  packageNameFa: string;
}

export interface MemberPackageDetail {
  package: MemberPackage;
  freezes: PackageFreeze[];
  refund: PackageRefund | null;
  receipts: Receipt[];
}

export interface MemberPackageQuery {
  search?: string;
  memberId?: string;
  branchId?: string;
  status?: MemberPackageStatus | "";
  page?: number;
  pageSize?: number;
}

export interface PurchaseRequest {
  memberId: string;
  packageId: string;
  branchId: string;
  paymentMethod: PaymentMethod;
}

export interface RefundRequest {
  amountToman?: number;
  reason?: string;
}

export interface ReceiptQuery {
  memberId?: string;
  branchId?: string;
  kind?: ReceiptKind | "";
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------- wallet (minimal core for wallet payments)

export interface WalletTransaction {
  id: string;
  amountToman: number; // signed: + credit / − debit
  kind: "TopUp" | "PackagePurchase" | "PackageRefund" | "BuffetPurchase";
  balanceAfter: number;
  relatedReceiptId?: string | null;
  note?: string | null;
  createdAtUtc: string;
}

export interface WalletSnapshot {
  memberId: string;
  hasAccount: boolean;
  balanceToman: number;
  recentTransactions: WalletTransaction[];
}

export interface Session {
  token: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
}
