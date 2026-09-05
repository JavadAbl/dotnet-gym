// Demo adapter — Coaching (Phase 6). Mirrors the .NET endpoints 1:1:
// same routes, same DTO shapes, same machine-readable errorCodes, same
// business gates (one active pair, plans/records need an active assignment,
// auto-archive on new plan).

import {
  GmsApiError,
  loadDb,
  saveDb,
  uid,
  wait,
  type DemoCoachAssignmentRecord,
  type DemoMemberPackageRecord,
  type DemoTrainingPlanRecord,
  type DemoTrainingRecordRecord,
} from "./demo-store";
import type {
  CoachAssignment,
  CoachAssignmentQuery,
  CoachListResponse,
  CoachingSummary,
  CreateAssignmentRequest,
  CreatePlanRequest,
  CreateRecordRequest,
  MemberStatus,
  PagedResult,
  TrainingPlan,
  TrainingPlanQuery,
  TrainingRecord,
  TrainingRecordQuery,
} from "./types";

type Db = ReturnType<typeof loadDb>;

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------- view enrichment (names resolved at read time)

function userById(db: Db, id: string) {
  return db.users.find((u) => u.id === id);
}

function memberById(db: Db, id: string) {
  return db.members.find((m) => m.id === id);
}

function branchById(db: Db, id: string) {
  return db.branches.find((b) => b.id === id);
}

function assignmentView(db: Db, rec: DemoCoachAssignmentRecord): CoachAssignment {
  const member = memberById(db, rec.memberId);
  const branch = branchById(db, rec.branchId);
  const coach = userById(db, rec.coachId);
  const { remaining, total } = privateCounters(db, rec.memberId);
  return {
    id: rec.id,
    coachId: rec.coachId,
    memberId: rec.memberId,
    branchId: rec.branchId,
    assignedAtUtc: rec.assignedAtUtc,
    releasedAtUtc: rec.releasedAtUtc,
    note: rec.note,
    coachName: coach?.displayName ?? "—",
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    memberStatus: (member?.status ?? "—") as MemberStatus,
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
    // Live presence — mirrors the backend's IAttendanceModule.IsMemberPresentAsync call.
    memberIsPresent: db.attendance.some((e) => e.memberId === rec.memberId && e.checkOutAtUtc === null),
    // v2 — live private-coaching counters (mirror of the backend's Sales contract enrichment).
    privateSessionsRemaining: remaining,
    privateSessionsTotal: total,
  };
}

function planView(db: Db, rec: DemoTrainingPlanRecord): TrainingPlan {
  const member = memberById(db, rec.memberId);
  const coach = userById(db, rec.coachId);
  return {
    id: rec.id,
    coachId: rec.coachId,
    memberId: rec.memberId,
    title: rec.title,
    goal: rec.goal,
    content: rec.content,
    isActive: rec.isActive,
    createdAtUtc: rec.createdAtUtc,
    archivedAtUtc: rec.archivedAtUtc,
    coachName: coach?.displayName ?? "—",
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
  };
}

function recordView(db: Db, rec: DemoTrainingRecordRecord): TrainingRecord {
  const member = memberById(db, rec.memberId);
  const coach = userById(db, rec.coachId);
  const branch = branchById(db, rec.branchId);
  const plan = rec.trainingPlanId ? db.trainingPlans.find((p) => p.id === rec.trainingPlanId) : undefined;
  return {
    id: rec.id,
    coachId: rec.coachId,
    memberId: rec.memberId,
    trainingPlanId: rec.trainingPlanId,
    branchId: rec.branchId,
    performedAtUtc: rec.performedAtUtc,
    summary: rec.summary,
    durationMinutes: rec.durationMinutes,
    intensity: rec.intensity,
    note: rec.note,
    coachName: coach?.displayName ?? "—",
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
    planTitle: plan?.title ?? null,
  };
}

// ---------------------------------------------------------------- shared gates (mirror backend precedence)

function requireCoach(db: Db, coachId: string): { id: string; displayName: string } {
  const user = userById(db, coachId);
  if (!user || user.role !== "coach") {
    throw new GmsApiError(404, "coaching.coach_not_found", "No active coach with this id.");
  }
  return { id: user.id, displayName: user.displayName };
}

function requireActiveMember(db: Db, memberId: string) {
  const member = memberById(db, memberId);
  if (!member) {
    throw new GmsApiError(404, "coaching.member_not_found", "Member not found.");
  }
  if (member.status !== "Active") {
    throw new GmsApiError(400, "coaching.member_inactive", "Coaching can only be assigned to active members.");
  }
  return member;
}

function requireActiveAssignment(db: Db, coachId: string, memberId: string) {
  const assignment = db.coachAssignments.find(
    (a) => a.coachId === coachId && a.memberId === memberId && a.releasedAtUtc === null,
  );
  if (!assignment) {
    throw new GmsApiError(
      409,
      "coaching.member_not_assigned",
      "The member is not assigned to this coach; assign them first.",
    );
  }
  return assignment;
}

function requireBranch(db: Db, branchId: string) {
  const branch = branchById(db, branchId);
  if (!branch) {
    throw new GmsApiError(404, "branch.not_found", "Branch not found.");
  }
  return branch;
}

// ---------------------------------------------------------------- v2 — private-coaching entitlement helpers

/** The member's best (soonest-expiring) usable private package — Active, not expired, sessions remaining. */
function bestUsablePrivatePackage(db: Db, memberId: string): DemoMemberPackageRecord | undefined {
  const nowIso = new Date().toISOString();
  return db.memberPackages
    .filter(
      (mp) =>
        mp.memberId === memberId &&
        (mp.packageKind ?? "Exercise") === "PrivateCoaching" &&
        mp.status === "Active" &&
        mp.expiresAtUtc > nowIso &&
        mp.sessionsUsed < mp.sessionsTotal,
    )
    .sort((a, b) => (a.expiresAtUtc > b.expiresAtUtc ? 1 : -1))[0];
}

function privateCounters(db: Db, memberId: string): { remaining: number | null; total: number | null } {
  const pkg = bestUsablePrivatePackage(db, memberId);
  return pkg
    ? { remaining: pkg.sessionsTotal - pkg.sessionsUsed, total: pkg.sessionsTotal }
    : { remaining: null, total: null };
}

function memberIdsForSearch(db: Db, term: string): Set<string> {
  const t = term.trim().toLowerCase();
  return new Set(
    db.members
      .filter(
        (m) =>
          m.fullName.toLowerCase().includes(t) ||
          m.code.toLowerCase().includes(t) ||
          (m.phoneNumber ?? "").includes(t) ||
          (m.cardCode ?? "").toLowerCase().includes(t),
      )
      .map((m) => m.id),
  );
}

function paginate<T>(items: T[], page: number, pageSize: number): PagedResult<T> {
  const totalCount = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount };
}

function resolvePage(page?: number, pageSize?: number) {
  return {
    page: page && page > 0 ? page : 1,
    pageSize: pageSize && pageSize > 0 ? Math.min(pageSize, 100) : 20,
  };
}

// ---------------------------------------------------------------- coaches

export async function demoListCoaches(): Promise<CoachListResponse> {
  await wait(150);
  const db = loadDb();
  const coaches = db.users
    .filter((u) => u.role === "coach")
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const activeAssignmentCounts: Record<string, number> = {};
  for (const coach of coaches) {
    activeAssignmentCounts[coach.id] = db.coachAssignments.filter(
      (a) => a.coachId === coach.id && a.releasedAtUtc === null,
    ).length;
  }

  return {
    items: coaches.map((c) => ({ id: c.id, displayName: c.displayName, username: c.username, branchId: c.branchId ?? null })),
    activeAssignmentCounts,
  };
}

// ---------------------------------------------------------------- assignments

export async function demoCreateAssignment(request: CreateAssignmentRequest): Promise<CoachAssignment> {
  await wait(300);
  const db = loadDb();

  requireCoach(db, request.coachId);
  const member = requireActiveMember(db, request.memberId);
  if (!request.branchId) {
    throw new GmsApiError(400, "validation.failed", "Branch could not be determined.", {
      branchId: ["Select the branch for this assignment."],
    });
  }
  requireBranch(db, request.branchId);

  // v2 gate — coaches only serve members with an ACTIVE private coach package (sessions remaining).
  if (!bestUsablePrivatePackage(db, member.id)) {
    throw new GmsApiError(
      409,
      "coaching.private_package_required",
      "The member needs an active private-coach package with sessions remaining before a coach can be assigned.",
    );
  }

  if (db.coachAssignments.some((a) => a.coachId === request.coachId && a.memberId === request.memberId && a.releasedAtUtc === null)) {
    throw new GmsApiError(409, "coaching.assignment_exists", "This coach already has an active assignment for this member.");
  }

  const rec: DemoCoachAssignmentRecord = {
    id: uid(),
    coachId: request.coachId,
    memberId: member.id,
    branchId: request.branchId,
    assignedAtUtc: new Date().toISOString(),
    releasedAtUtc: null,
    note: request.note?.trim() || null,
  };
  db.coachAssignments.push(rec);
  saveDb(db);
  return assignmentView(db, rec);
}

export async function demoListCoachAssignments(query: CoachAssignmentQuery): Promise<PagedResult<CoachAssignment>> {
  await wait(180);
  const db = loadDb();
  const { page, pageSize } = resolvePage(query.page, query.pageSize);

  let items = [...db.coachAssignments];
  if (query.coachId) items = items.filter((a) => a.coachId === query.coachId);
  if (query.memberId) items = items.filter((a) => a.memberId === query.memberId);
  if (query.branchId) items = items.filter((a) => a.branchId === query.branchId);
  if (query.status === "active") items = items.filter((a) => a.releasedAtUtc === null);
  if (query.status === "released") items = items.filter((a) => a.releasedAtUtc !== null);

  if (query.search?.trim()) {
    const ids = memberIdsForSearch(db, query.search);
    items = items.filter((a) => ids.has(a.memberId));
  }

  // Active first, then newest (same ordering as the backend).
  items.sort((a, b) => {
    const aActive = a.releasedAtUtc === null ? 0 : 1;
    const bActive = b.releasedAtUtc === null ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.assignedAtUtc < b.assignedAtUtc ? 1 : -1;
  });

  return paginate(items.map((a) => assignmentView(db, a)), page, pageSize);
}

export async function demoReleaseAssignment(assignmentId: string): Promise<CoachAssignment> {
  await wait(240);
  const db = loadDb();
  const rec = db.coachAssignments.find((a) => a.id === assignmentId);
  if (!rec) {
    throw new GmsApiError(404, "coaching.assignment_not_found", "Coach assignment not found.");
  }
  if (rec.releasedAtUtc !== null) {
    throw new GmsApiError(409, "coaching.already_released", "This assignment has already been released.");
  }
  rec.releasedAtUtc = new Date().toISOString();
  saveDb(db);
  return assignmentView(db, rec);
}

// ---------------------------------------------------------------- training plans

export async function demoCreateTrainingPlan(request: CreatePlanRequest): Promise<TrainingPlan> {
  await wait(320);
  const db = loadDb();

  const coachId = request.coachId;
  if (!coachId) {
    throw new GmsApiError(400, "validation.failed", "coachId is required.", {
      coachId: ["Select the coach this action belongs to."],
    });
  }
  requireCoach(db, coachId);
  const member = requireActiveMember(db, request.memberId);
  requireActiveAssignment(db, coachId, member.id);

  const title = request.title?.trim();
  const content = request.content?.trim();
  const fieldErrors: Record<string, string[]> = {};
  if (!title) fieldErrors.title = ["Plan title is required."];
  if (!content) fieldErrors.content = ["Plan content is required."];
  if (Object.keys(fieldErrors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", fieldErrors);
  }

  // Auto-archive the author's previous active plan for this member (exactly one active per pair).
  const nowIso = new Date().toISOString();
  for (const plan of db.trainingPlans) {
    if (plan.coachId === coachId && plan.memberId === member.id && plan.isActive) {
      plan.isActive = false;
      plan.archivedAtUtc = nowIso;
    }
  }

  const rec: DemoTrainingPlanRecord = {
    id: uid(),
    coachId,
    memberId: member.id,
    title: title!,
    goal: request.goal?.trim() || null,
    content: content!,
    isActive: true,
    archivedAtUtc: null,
    createdAtUtc: nowIso,
  };
  db.trainingPlans.push(rec);
  saveDb(db);
  return planView(db, rec);
}

export async function demoListTrainingPlans(query: TrainingPlanQuery): Promise<PagedResult<TrainingPlan>> {
  await wait(180);
  const db = loadDb();
  const { page, pageSize } = resolvePage(query.page, query.pageSize);

  let items = [...db.trainingPlans];
  if (query.coachId) items = items.filter((p) => p.coachId === query.coachId);
  if (query.memberId) items = items.filter((p) => p.memberId === query.memberId);
  if (query.activeOnly) items = items.filter((p) => p.isActive);

  if (query.search?.trim()) {
    const ids = memberIdsForSearch(db, query.search);
    items = items.filter((p) => ids.has(p.memberId));
  }

  items.sort((a, b) => (a.createdAtUtc < b.createdAtUtc ? 1 : -1));
  return paginate(items.map((p) => planView(db, p)), page, pageSize);
}

export async function demoArchiveTrainingPlan(planId: string): Promise<TrainingPlan> {
  await wait(240);
  const db = loadDb();
  const rec = db.trainingPlans.find((p) => p.id === planId);
  if (!rec) {
    throw new GmsApiError(404, "coaching.plan_not_found", "Training plan not found.");
  }
  if (!rec.isActive) {
    throw new GmsApiError(409, "coaching.plan_not_active", "This plan is already archived.");
  }
  rec.isActive = false;
  rec.archivedAtUtc = new Date().toISOString();
  saveDb(db);
  return planView(db, rec);
}

// ---------------------------------------------------------------- training records

export async function demoCreateTrainingRecord(request: CreateRecordRequest): Promise<TrainingRecord> {
  await wait(320);
  const db = loadDb();

  const coachId = request.coachId;
  if (!coachId) {
    throw new GmsApiError(400, "validation.failed", "coachId is required.", {
      coachId: ["Select the coach this action belongs to."],
    });
  }
  requireCoach(db, coachId);
  const member = requireActiveMember(db, request.memberId);
  requireActiveAssignment(db, coachId, member.id);

  const summary = request.summary?.trim();
  const fieldErrors: Record<string, string[]> = {};
  if (!summary) fieldErrors.summary = ["Session summary is required."];
  if (request.durationMinutes !== undefined && (request.durationMinutes < 1 || request.durationMinutes > 600)) {
    fieldErrors.durationMinutes = ["Duration must be between 1 and 600 minutes."];
  }
  if (request.intensity && !["Low", "Medium", "High"].includes(request.intensity)) {
    fieldErrors.intensity = ["Intensity must be Low, Medium or High."];
  }
  const performedAt = request.performedAtUtc ?? new Date().toISOString();
  if (performedAt > daysFromNow(0)) {
    fieldErrors.performedAtUtc = ["The session time cannot be in the future."];
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new GmsApiError(400, "validation.failed", "One or more validation errors occurred.", fieldErrors);
  }

  if (request.branchId) {
    requireBranch(db, request.branchId);
  }

  if (request.trainingPlanId) {
    const plan = db.trainingPlans.find((p) => p.id === request.trainingPlanId);
    if (!plan || plan.coachId !== coachId || plan.memberId !== member.id) {
      throw new GmsApiError(404, "coaching.plan_not_found", "Training plan not found for this coach-member pair.");
    }
  }

  // v2 — logging a session consumes ONE private-coaching session (FEFO), mirroring the
  // backend's atomic conditional UPDATE. Exhausted/missing entitlement ⇒ precise denial.
  const privatePackage = bestUsablePrivatePackage(db, member.id);
  if (!privatePackage) {
    throw new GmsApiError(
      409,
      "coaching.no_private_sessions",
      "The member has no private-coach package sessions remaining; sell a private coaching package first.",
    );
  }
  privatePackage.sessionsUsed += 1;

  const rec: DemoTrainingRecordRecord = {
    id: uid(),
    coachId,
    memberId: member.id,
    trainingPlanId: request.trainingPlanId || null,
    branchId: request.branchId ?? member.homeBranchId,
    performedAtUtc: performedAt,
    summary: summary!,
    durationMinutes: request.durationMinutes ?? null,
    intensity: request.intensity ?? null,
    note: request.note?.trim() || null,
  };
  db.trainingRecords.push(rec);
  saveDb(db);
  return recordView(db, rec);
}

export async function demoListTrainingRecords(query: TrainingRecordQuery): Promise<PagedResult<TrainingRecord>> {
  await wait(180);
  const db = loadDb();
  const { page, pageSize } = resolvePage(query.page, query.pageSize);

  let items = [...db.trainingRecords];
  if (query.coachId) items = items.filter((r) => r.coachId === query.coachId);
  if (query.memberId) items = items.filter((r) => r.memberId === query.memberId);
  if (query.branchId) items = items.filter((r) => r.branchId === query.branchId);

  if (query.search?.trim()) {
    const ids = memberIdsForSearch(db, query.search);
    items = items.filter((r) => ids.has(r.memberId));
  }

  items.sort((a, b) => (a.performedAtUtc < b.performedAtUtc ? 1 : -1));
  return paginate(items.map((r) => recordView(db, r)), page, pageSize);
}

// ---------------------------------------------------------------- summary (coach workspace KPIs)

export async function demoCoachingSummary(coachId?: string): Promise<CoachingSummary> {
  await wait(160);
  const db = loadDb();

  const assignments = db.coachAssignments.filter(
    (a) => a.releasedAtUtc === null && (!coachId || a.coachId === coachId),
  );
  const plans = db.trainingPlans.filter((p) => p.isActive && (!coachId || p.coachId === coachId));
  const records = db.trainingRecords.filter(
    (r) => r.performedAtUtc >= daysFromNow(-7) && (!coachId || r.coachId === coachId),
  );

  let membersPresentNow = 0;
  const seen = new Set<string>();
  for (const assignment of assignments.slice(0, 100)) {
    if (seen.has(assignment.memberId)) continue;
    seen.add(assignment.memberId);
    if (db.attendance.some((e) => e.memberId === assignment.memberId && e.checkOutAtUtc === null)) {
      membersPresentNow++;
    }
  }

  return {
    activeAssignments: assignments.length,
    activePlans: plans.length,
    recordsLast7Days: records.length,
    membersPresentNow,
  };
}
