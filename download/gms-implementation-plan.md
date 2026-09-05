# GMS — Gym Management System · Implementation Plan v1.2

> Authoritative architecture & roadmap document. Restored 2026-09-05 (workspace reset) — content re-derived from the confirmed decisions of the planning session.
> **v1.2 amendment (2026-09-05):** §6 Private Coach Packages — v2 feature decisions appended after the v1 roadmap completed (all 10 phases, 100%).

## 1. Product Summary

Multi-branch gym management system for internal operators (reception, buffet, coach, admin).
Members buy exercise packages (session count + duration), swipe their card to enter, buy
buffet items with cash or their wallet balance, and coaches attach training plans/records.

**Confirmed decisions (locked):**
1. **Languages:** Persian (`fa`, RTL-first) + English (`en`). UI bilingual; data stored language-neutral.
2. **Currency:** Toman, stored as integer `long` — never floats.
3. **No PWA / no member-facing app in v1** — internal admin/operator web app only (mobile-ready API).
4. **Packages:** global definition + global price, then granted per-branch via `PackageBranchAccess`.
   Only buffet products have per-branch pricing (`BuffetProductPrice`).
5. **Single payment method per receipt** — cash OR wallet, never mixed.
6. **v1 includes package freeze/unfreeze** (unfreeze extends expiry by frozen days) **and refunds/cancellation**.
7. **No buffet inventory tracking.**
8. **No coach commissions.**

## 2. Architecture — Modular Monolith

ASP.NET Core 8 minimal APIs. One class library per business module, each with its **own
DbContext and SQLite database file**. Cross-module interaction **only** via the module's
`.Public` contract project (interfaces + DTOs). **No cross-module FKs, no cross-module JOINs** —
store the id, then resolve via the public contract. No AutoMapper — hand-written
`ToDto()` extension methods.

```
Gms.sln
├── src/BuildingBlocks/Gms.BuildingBlocks/        # shared kernel (no business logic)
├── src/Api/Gms.Api/                              # host: auth, routing, ProblemDetails, seeding, WAL
└── src/Modules/
    ├── Gms.Modules.Identity/        + .Public    # users, roles (admin|reception|buffet|coach), JWT
    ├── Gms.Modules.Branches/        + .Public    # gym branches
    ├── Gms.Modules.Members/         + .Public    # member registry  ← Phase 2
    ├── Gms.Modules.Catalog/         + .Public    # exercise packages, branch access, buffet products/prices
    ├── Gms.Modules.Sales/           + .Public    # member package purchases, freeze/refund, receipts
    ├── Gms.Modules.Attendance/      + .Public    # check-in / check-out, entry validation, atomic session consumption
    ├── Gms.Modules.Wallet/          + .Public    # wallet accounts, top-up, ledger (BalanceAfter)
    ├── Gms.Modules.Coaching/        + .Public    # coach packages, training plans, training records
    └── Gms.Modules.Buffet/          + .Public    # buffet orders (cash | wallet)
```

### Module rules (hard)
- Each module: `Domain/`, `Infrastructure/` (DbContext), `Features/` (minimal API endpoints), `XxxModule.cs` (DI wiring), `Public/` in the sibling `.Public` project.
- DTO mapping = manual extension methods (`MemberMappings.cs`).
- Cross-module: inject the `.Public` interface only (e.g. `IMembersModule`, `IBranchesModule`).
- Each module has its **own connection string** (`ConnectionStrings:Members` etc.) → separate `.db` file.

### Key entities
| Module | Entities |
|---|---|
| Identity | `AppUser` (username, password hash, role, branchId, isActive) |
| Branches | `Branch` (name, city, phone, isActive) |
| Members | `Member` (code, fullName, phone, gender, birthDate, joinDate, homeBranchId, cardCode, status, notes) |
| Catalog | `ExercisePackage` (name, sessionsCount, durationDays, price, isActive), `PackageBranchAccess`, `BuffetProduct`, `BuffetProductPrice` (per branch) |
| Sales | `MemberPackage` (memberId, packageId, branchId, sessionsTotal, sessionsUsed, startedAt, expiresAt, status: Active\|Frozen\|Refunded, pricePaid), `PackageFreeze`, `Refund`, `Receipt` (single payment method) |
| Attendance | `AttendanceEntry` (memberId, memberPackageId, branchId, checkInAt, checkOutAt) |
| Wallet | `WalletAccount` (memberId, balance), `WalletTransaction` (amount ±, type, BalanceAfter, relatedReceiptId) |
| Coaching | `CoachAssignment` (coachId, memberId), `TrainingPlan`, `TrainingRecord` |
| Buffet | `BuffetOrder` (memberId, branchId, paymentMethod: Cash\|Wallet, total), `BuffetOrderItem` |

### Entry validation (Attendance, Phase 4)
Member must be Active; has a MemberPackage with status Active, not frozen, not expired,
`sessionsUsed < sessionsTotal`, and current branch in the package's branch access list.
Session consumption must be atomic: `UPDATE MemberPackage SET SessionsUsed = SessionsUsed + 1
WHERE Id = @id AND SessionsUsed < SessionsTotal` (checked rows = 1 ⇒ success).

## 3. API Conventions
- All routes under `/api/v1/...` (mobile-ready).
- Auth: JWT Bearer; claims: `sub` (userId), `role` (admin|reception|buffet|coach), `branchId`.
- Errors: RFC7807 ProblemDetails + machine-readable `errorCode` extension (e.g. `member.phone.duplicate`, `member.not_found`).
- Money in request/response bodies = integer Toman.
- Timestamps UTC (ISO-8601); UI renders Jalali for `fa`.
- List endpoints: `?search=&page=1&pageSize=20` → `{ items, page, pageSize, totalCount }`.

## 4. Tech & Environment Constraints
- **This sandbox has no .NET SDK** → backend is written as source here; the user runs
  `dotnet restore && dotnet run --project src/Api/Gms.Api` locally (.NET 8 SDK, EF Core 8 + `Microsoft.EntityFrameworkCore.Sqlite`).
- Dev bootstrap uses `EnsureCreatedAsync()` + seeders (migration files start Phase 9/hardening).
- WAL enforced once at startup per database: `PRAGMA journal_mode=WAL;`.
- Frontend: Next.js 16 + TypeScript + Tailwind + shadcn/ui, RTL-first, runs in this sandbox (port 3000).
  `NEXT_PUBLIC_GMS_API_BASE` switches the UI between the real .NET API and a built-in demo adapter
  (same contract, browser-local persistence) so the sandbox preview is fully interactive.

## 5. Roadmap (10 phases, weighted)
| Phase | Scope | Weight |
|---|---|---|
| 0 | Solution skeleton: sln, BuildingBlocks, Api host, 9 modules + .Public, JWT wiring, SQLite WAL, Next.js RTL shell | 8% |
| 1 | Seed data: admin + operators, North/South branches, VIP (all branches) / Basic (South only) packages, buffet sample products | 7% |
| 2 | **Members module**: registry CRUD + search/paging + status + card code; admin UI members workspace | 12% |
| 3 | Sales: purchase packages (cash/wallet receipt), member packages, freeze/unfreeze, refund | 15% |
| 4 | Attendance: check-in with entry validation + atomic session consumption, live presence, history | 13% |
| 5 | Wallet: account, top-up receipt, ledger with BalanceAfter, wallet payments for sales/buffet | 10% |
| 6 | Coaching: coach assignments, training plans, training records, coach workspace | 10% |
| 7 | Buffet: products & per-branch prices admin, POS order (cash/wallet) | 10% |
| 8 | Frontend completion: dashboards, reports, role-aware workspaces, Jalali/RTL polish | 10% |
| 9 | Hardening: EF migrations, rate limiting, audit logs, tests, deployment docs | 5% |

## 6. v2 Amendment — Private Coach Packages (2026-09-05, confirmed)

1. **Coach service requires entitlement:** a coach may only be assigned to (and may only log
   training sessions for) members holding an **active PrivateCoaching package** — status Active,
   not expired, sessions remaining. Assignment without it → `coaching.private_package_required`;
   logging a session with an exhausted/missing entitlement → `coaching.no_private_sessions`.
2. **Private packages are bought like exercise packages** — same selling flow (member + branch +
   cash XOR wallet receipt), same global pricing + per-branch grants, freeze/unfreeze and refund
   semantics included. Each logged training session **atomically consumes one private session**
   (FEFO: soonest expiry first) through the same conditional-UPDATE pattern as attendance.
3. **Kind discrimination:** packages gain `Kind ∈ {Exercise, PrivateCoaching}` (Catalog) and every
   purchase snapshots `PackageKind` (Sales) so later catalog edits never rewrite history.
4. **Strict kind isolation:** gym check-in (Attendance) consumes **Exercise** packages only —
   private sessions can never pay for gym entry; coaching sessions consume **PrivateCoaching**
   packages only. Both directions are enforced in code and pinned by tests.
5. **Traceability:** each training record stores the consumed member-package id (cross-module id,
   no FK). Assignment views expose live `privateSessionsRemaining/Total` counters.
6. Unchanged locked decisions: bilingual fa/en (RTL-first), integer Toman `long`, single payment
   method per receipt, no PWA, no inventory, no commissions, `.Public`-contract-only cross-module
   access, one SQLite DB per module with WAL, ProblemDetails + `errorCode` everywhere.
