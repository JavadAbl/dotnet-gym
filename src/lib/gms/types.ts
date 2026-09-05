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
export type ReceiptKind = "PackagePurchase" | "PackageRefund" | "TopUp";

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
  /** Null for TopUp receipts — they are not tied to any exercise package (Phase 5). */
  memberPackageId: string | null;
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

// ---------------------------------------------------------------- attendance (Phase 4)

export interface AttendanceEntry {
  id: string;
  memberId: string;
  memberPackageId: string;
  branchId: string;
  checkInAtUtc: string;
  checkOutAtUtc?: string | null;
  durationMinutes: number;
  isPresent: boolean;
  // enrichment resolved by the API / demo adapter
  memberCode: string;
  memberFullName: string;
  packageNameEn: string;
  packageNameFa: string;
  branchNameEn: string;
  branchNameFa: string;
  // live state of the consumed member package
  sessionsTotal?: number | null;
  sessionsUsed?: number | null;
  sessionsRemaining?: number | null;
}

export interface PresenceBoard {
  items: AttendanceEntry[];
  count: number;
  visitsToday: number;
}

export interface CheckInRequest {
  cardCode: string;
  branchId?: string;
}

export interface AttendanceQuery {
  search?: string;
  memberId?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------- wallet (Phase 5)

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

export interface WalletAccountRow {
  memberId: string;
  memberCode: string;
  memberFullName: string;
  balanceToman: number;
  lastActivityAtUtc?: string | null;
}

export interface WalletAccountsQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Accounts page plus the total balance held across the filtered set (workspace KPI). */
export interface WalletAccountsPage extends PagedResult<WalletAccountRow> {
  totalBalanceToman: number;
}

export interface WalletTransactionsQuery {
  kind?: WalletTransaction["kind"] | "";
  page?: number;
  pageSize?: number;
}

export interface TopUpRequest {
  amountToman: number;
  branchId?: string;
  note?: string;
}

export interface TopUpResponse {
  memberId: string;
  receiptId: string;
  transactionId: string;
  amountToman: number;
  balanceToman: number;
}

// ---------------------------------------------------------------- coaching (Phase 6)

export interface Coach {
  id: string;
  displayName: string;
  username: string;
  branchId?: string | null;
}

/** Coach list for the assignment dialog, plus each coach's open assignment count. */
export interface CoachListResponse {
  items: Coach[];
  activeAssignmentCounts: Record<string, number>;
}

export interface CoachAssignment {
  id: string;
  coachId: string;
  memberId: string;
  branchId: string;
  assignedAtUtc: string;
  releasedAtUtc?: string | null;
  note?: string | null;
  // enrichment resolved by the API / demo adapter
  coachName: string;
  memberCode: string;
  memberFullName: string;
  memberStatus: MemberStatus;
  branchNameEn: string;
  branchNameFa: string;
  /** Live from the Attendance module — the member is currently checked in. */
  memberIsPresent: boolean;
}

export interface TrainingPlan {
  id: string;
  coachId: string;
  memberId: string;
  title: string;
  goal?: string | null;
  content: string;
  isActive: boolean;
  createdAtUtc: string;
  archivedAtUtc?: string | null;
  coachName: string;
  memberCode: string;
  memberFullName: string;
}

export interface TrainingRecord {
  id: string;
  coachId: string;
  memberId: string;
  trainingPlanId?: string | null;
  branchId: string;
  performedAtUtc: string;
  summary: string;
  durationMinutes?: number | null;
  intensity?: "Low" | "Medium" | "High" | null;
  note?: string | null;
  coachName: string;
  memberCode: string;
  memberFullName: string;
  branchNameEn: string;
  branchNameFa: string;
  planTitle?: string | null;
}

export interface CoachingSummary {
  activeAssignments: number;
  activePlans: number;
  recordsLast7Days: number;
  membersPresentNow: number;
}

export interface CoachAssignmentQuery {
  coachId?: string;
  memberId?: string;
  branchId?: string;
  status?: "active" | "released" | "";
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TrainingPlanQuery {
  coachId?: string;
  memberId?: string;
  activeOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface TrainingRecordQuery {
  coachId?: string;
  memberId?: string;
  branchId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateAssignmentRequest {
  coachId: string;
  memberId: string;
  branchId?: string;
  note?: string;
}

export interface CreatePlanRequest {
  coachId?: string;
  memberId: string;
  title: string;
  goal?: string;
  content: string;
}

export interface CreateRecordRequest {
  coachId?: string;
  memberId: string;
  trainingPlanId?: string;
  summary: string;
  performedAtUtc?: string;
  durationMinutes?: number;
  intensity?: "Low" | "Medium" | "High";
  note?: string;
  branchId?: string;
}

export interface Session {
  token: string;
  expiresAt: number; // epoch ms
  user: AuthUser;
}
