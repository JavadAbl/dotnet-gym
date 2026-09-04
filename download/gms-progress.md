# GMS Progress Tracker

Weighted total: **▓▓▓░░░░░░░░░░░░░░░░░░ 27%**

> Updated: 2026-09-05 — workspace was reset between sessions; Phase 0/1 artifacts were rebuilt this session, then Phase 2 implemented and browser-verified end-to-end.

## Phase 0 — Solution skeleton (8%) ✅ rebuilt
- [x] `Gms.sln` + BuildingBlocks + Api host + 9 modules with `.Public` contract projects
- [x] JWT authentication wiring (role + branchId claims)
- [x] SQLite WAL enforcement + `EnsureCreated` bootstrap per module DB
- [x] ProblemDetails + `errorCode` convention (GmsExceptionHandler)
- [x] Next.js RTL (fa) shell with shadcn/ui

## Phase 1 — Seed data (7%) ✅ rebuilt
- [x] admin user (`admin` / `Admin@123`, PBKDF2) + reception/buffet/coach operators
- [x] Branches: North (شعبه شمال) & South (شعبه جنوب)
- [x] Exercise packages: VIP 12 sessions/30d @ 2,500,000 T (both branches) · Basic 8/14d @ 1,200,000 T (South only)
- [x] Buffet sample products with per-branch prices

## Phase 2 — Members module (12%) ✅
- [x] `Member` entity + status (Active/Inactive/Blocked) + auto code `M-0001` + card code
- [x] Endpoints: POST /api/v1/members · GET search (paged) · GET {id} · PUT {id} · POST {id}/status
- [x] Duplicate-phone guard → `member.phone.duplicate` errorCode; manual DTO mappings (no AutoMapper)
- [x] Demo member seeds
- [x] Frontend: Members workspace (table, search, filters, create/edit dialog, detail sheet, activate/deactivate), Packages & Branches views, fa/en i18n, Jalali dates

## Phase 3 — Sales (15%) ⬜
- [ ] Member package purchase (cash/wallet receipt, single payment method)
- [ ] Freeze / unfreeze (expiry shift) · refund/cancel
- [ ] UI: sell-package flow + member packages tab

## Phase 4 — Attendance (13%) ⬜
- [ ] Card-swipe check-in with entry validation
- [ ] Atomic session consumption (`UPDATE ... WHERE SessionsUsed < SessionsTotal`)
- [ ] Live presence board + history

## Phase 5 — Wallet (10%) ⬜
- [ ] Wallet account + top-up receipt, ledger with BalanceAfter
- [ ] Wallet payment integration (sales / buffet)

## Phase 6 — Coaching (10%) ⬜
- [ ] Coach assignments · training plans · training records · coach workspace

## Phase 7 — Buffet (10%) ⬜
- [ ] Product & per-branch price admin · POS order (cash/wallet)

## Phase 8 — Frontend completion (10%) ⬜
- [ ] Dashboards/reports · role-aware workspaces · Jalali/RTL polish

## Phase 9 — Hardening (5%) ⬜
- [ ] EF migrations replace EnsureCreated · rate limiting · audit log · tests · deploy docs
