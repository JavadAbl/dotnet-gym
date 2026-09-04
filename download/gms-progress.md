# GMS Progress Tracker

Weighted total: **▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 42%**

> Updated: 2026-09-05 — Phase 3 (Sales) delivered end-to-end and browser-verified.
> Note: while wiring Sales, three latent Phase 0 compile blockers were found and fixed
> (missing TargetFramework/ImplicitUsings, missing DI global usings, missing Api project refs).

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

## Phase 3 — Sales (15%) ✅
- [x] `MemberPackage` (SessionsTotal/Used, expiry, status Active|Frozen|Refunded) + `PackageFreeze` + `Refund` + `Receipt` (single payment method per receipt, locked decision #5)
- [x] Endpoints: POST /api/v1/sales/member-packages (cash XOR wallet) · GET paged search (search/status/branchId/memberId) · GET {id} detail (freezes+refund+receipts) · POST {id}/freeze · POST {id}/unfreeze (expiry shifted by frozen days) · POST {id}/refund (pro-rata default, mirrors original payment method) · GET /api/v1/sales/receipts
- [x] Wallet minimal core pulled forward from Phase 5: `WalletAccount`/`WalletTransaction` (ledger invariant BalanceAfter), conditional debit + credit via `IWalletModule` contract, compensation on failed sales persist, wallet snapshot endpoint, opening-balance seeds
- [x] Cross-module enrichment via public contracts only (Members.GetBatchAsync/FindIdsAsync added; no cross-module JOINs); errorCodes: sales.member_inactive, sales.invalid_state, sales.package_expired, sales.already_refunded, sales.refund_amount_invalid, wallet.insufficient_balance, …
- [x] `ISalesModule.TryConsumeSessionAsync` (atomic `ExecuteUpdate WHERE SessionsUsed < SessionsTotal`) ready for Phase 4 attendance gate
- [x] Demo seeds: 5 member packages (1 frozen, 1 refunded) + ledger-consistent wallet purchase
- [x] Frontend: Sales workspace (member packages + receipts tabs, filters, session progress bars, row actions), sell-package dialog (member search, branch-scoped packages, wallet balance + insufficient guard), refund dialog (pro-rata prefill, editable amount, reason), member detail sheet shows real packages + sell shortcut; fa/en + RTL + Jalali
- [x] Verified: eslint/tsc/next build clean; browser E2E — freeze/unfreeze, wallet purchase (ledger 5M→2.5M→0→2.5M), refund credit-back, receipts tab, member sheet, EN/LTR, mobile 390px; zero console errors

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
