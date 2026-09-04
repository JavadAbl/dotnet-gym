// Demo adapter — Attendance (Phase 4). Mirrors the .NET endpoints 1:1:
// same routes, same DTO shapes, same machine-readable errorCodes, same
// entry-validation pipeline and atomic-style session consumption.

import { GmsApiError, loadDb, saveDb, uid, wait, type DemoAttendanceRecord } from "./demo-store";
import type { AttendanceEntry, AttendanceQuery, CheckInRequest, PagedResult, PresenceBoard } from "./types";

const minutesAgoIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function entryView(db: ReturnType<typeof loadDb>, entry: DemoAttendanceRecord): AttendanceEntry {
  const member = db.members.find((m) => m.id === entry.memberId);
  const branch = db.branches.find((b) => b.id === entry.branchId);
  const memberPackage = db.memberPackages.find((mp) => mp.id === entry.memberPackageId);
  const pkg = memberPackage ? db.packages.find((p) => p.id === memberPackage.packageId) : undefined;
  const endMs = entry.checkOutAtUtc ? new Date(entry.checkOutAtUtc).getTime() : Date.now();

  return {
    ...entry,
    durationMinutes: Math.max(0, Math.floor((endMs - new Date(entry.checkInAtUtc).getTime()) / 60_000)),
    isPresent: entry.checkOutAtUtc === null,
    memberCode: member?.code ?? "—",
    memberFullName: member?.fullName ?? "—",
    packageNameEn: pkg?.nameEn ?? "—",
    packageNameFa: pkg?.nameFa ?? "—",
    branchNameEn: branch?.nameEn ?? "—",
    branchNameFa: branch?.nameFa ?? "—",
    sessionsTotal: memberPackage?.sessionsTotal ?? null,
    sessionsUsed: memberPackage?.sessionsUsed ?? null,
    sessionsRemaining: memberPackage
      ? Math.max(0, memberPackage.sessionsTotal - memberPackage.sessionsUsed)
      : null,
  };
}

/** Precise denial classification — same precedence as the backend CheckInEndpoint. */
function classifyDenial(
  db: ReturnType<typeof loadDb>,
  memberId: string,
  hasBranchCandidates: boolean,
  nowIso: string,
): { errorCode: string; message: string } {
  const memberPackages = db.memberPackages.filter((mp) => mp.memberId === memberId);

  if (hasBranchCandidates) {
    return {
      errorCode: "attendance.branch_not_allowed",
      message: "The member's package is not granted to this branch.",
    };
  }
  if (memberPackages.some((mp) => mp.status === "Frozen")) {
    return {
      errorCode: "attendance.package_frozen",
      message: "The member's package is frozen; unfreeze it before check-in.",
    };
  }
  if (memberPackages.some((mp) => mp.status === "Active" && mp.expiresAtUtc <= nowIso)) {
    return {
      errorCode: "attendance.package_expired",
      message: "The member's package has expired.",
    };
  }
  if (
    memberPackages.some(
      (mp) => mp.status === "Active" && mp.expiresAtUtc > nowIso && mp.sessionsUsed >= mp.sessionsTotal,
    )
  ) {
    return {
      errorCode: "attendance.no_sessions_remaining",
      message: "The member's package has no sessions remaining.",
    };
  }
  return {
    errorCode: "attendance.no_active_package",
    message: "The member has no usable exercise package.",
  };
}

// ---------------------------------------------------------------- check-in / check-out

export async function demoCheckIn(request: CheckInRequest): Promise<AttendanceEntry> {
  await wait(320);
  const db = loadDb();

  const cardCode = request.cardCode?.trim();
  if (!cardCode) {
    throw new GmsApiError(400, "validation.failed", "Card code is required.", {
      cardCode: ["Swipe a card or type its code."],
    });
  }
  if (!request.branchId) {
    throw new GmsApiError(400, "validation.failed", "Branch could not be determined.", {
      branchId: ["Select the branch for this check-in."],
    });
  }
  const branch = db.branches.find((b) => b.id === request.branchId);
  if (!branch) {
    throw new GmsApiError(404, "branch.not_found", "Branch not found.");
  }

  // member gate: card must resolve, member must be Active
  const member = db.members.find((m) => m.cardCode === cardCode);
  if (!member) {
    throw new GmsApiError(404, "attendance.member_not_found", "No member is registered with this card code.");
  }
  if (member.status !== "Active") {
    throw new GmsApiError(400, "attendance.member_inactive", "Inactive or blocked members cannot check in.");
  }

  // presence gate: one open visit at a time
  if (db.attendance.some((e) => e.memberId === member.id && e.checkOutAtUtc === null)) {
    throw new GmsApiError(409, "attendance.already_checked_in", "This member is already checked in.");
  }

  // package gate: Active, not expired, sessions remaining, granted to this branch
  const nowIso = new Date().toISOString();
  const candidates = db.memberPackages.filter(
    (mp) => mp.memberId === member.id && mp.status === "Active" && mp.expiresAtUtc > nowIso && mp.sessionsUsed < mp.sessionsTotal,
  );
  const usable = candidates.filter((mp) => {
    const pkg = db.packages.find((p) => p.id === mp.packageId);
    return pkg?.branchIds.includes(request.branchId!) ?? false;
  });

  if (usable.length === 0) {
    const denial = classifyDenial(db, member.id, candidates.length > 0, nowIso);
    throw new GmsApiError(409, denial.errorCode, denial.message);
  }

  // Use the package expiring soonest first (FEFO), then consume the session.
  usable.sort((a, b) => (a.expiresAtUtc > b.expiresAtUtc ? 1 : -1));
  const chosen = usable[0];
  chosen.sessionsUsed += 1; // mirrors the backend's atomic UPDATE ... WHERE SessionsUsed < SessionsTotal

  const entry: DemoAttendanceRecord = {
    id: uid(),
    memberId: member.id,
    memberPackageId: chosen.id,
    branchId: request.branchId,
    checkInAtUtc: nowIso,
    checkOutAtUtc: null,
    durationMinutes: 0,
    isPresent: true,
    memberCode: member.code,
    memberFullName: member.fullName,
    packageNameEn: chosen.packageNameEn,
    packageNameFa: chosen.packageNameFa,
    branchNameEn: branch.nameEn,
    branchNameFa: branch.nameFa,
    sessionsTotal: chosen.sessionsTotal,
    sessionsUsed: chosen.sessionsUsed,
    sessionsRemaining: Math.max(0, chosen.sessionsTotal - chosen.sessionsUsed),
  };
  db.attendance.push(entry);
  saveDb(db);
  return entryView(db, entry);
}

export async function demoCheckOut(entryId: string): Promise<AttendanceEntry> {
  await wait(260);
  const db = loadDb();
  const entry = db.attendance.find((e) => e.id === entryId);
  if (!entry) {
    throw new GmsApiError(404, "attendance.entry_not_found", "Attendance entry not found.");
  }
  if (entry.checkOutAtUtc !== null) {
    throw new GmsApiError(409, "attendance.already_checked_out", "This visit is already closed.");
  }
  entry.checkOutAtUtc = new Date().toISOString();
  saveDb(db);
  return entryView(db, entry);
}

// ---------------------------------------------------------------- presence + history

export async function demoPresence(branchId?: string): Promise<PresenceBoard> {
  await wait(180);
  const db = loadDb();
  const todayStartIso = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").toISOString();

  const open = db.attendance
    .filter((e) => e.checkOutAtUtc === null && (!branchId || e.branchId === branchId))
    .sort((a, b) => (a.checkInAtUtc < b.checkInAtUtc ? 1 : -1));

  const visitsToday = db.attendance.filter(
    (e) => e.checkInAtUtc >= todayStartIso && (!branchId || e.branchId === branchId),
  ).length;

  return {
    items: open.map((e) => entryView(db, e)),
    count: open.length,
    visitsToday,
  };
}

export async function demoSearchAttendance(query: AttendanceQuery): Promise<PagedResult<AttendanceEntry>> {
  await wait(180);
  const db = loadDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;

  let items = [...db.attendance];
  if (query.memberId) items = items.filter((e) => e.memberId === query.memberId);
  if (query.branchId) items = items.filter((e) => e.branchId === query.branchId);

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
    items = items.filter((e) => matchingMemberIds.has(e.memberId));
  }

  items.sort((a, b) => (a.checkInAtUtc < b.checkInAtUtc ? 1 : -1));
  const totalCount = items.length;
  const paged = items.slice((page - 1) * pageSize, page * pageSize).map((e) => entryView(db, e));
  return { items: paged, page, pageSize, totalCount };
}
