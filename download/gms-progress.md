# GMS Progress Tracker

Weighted total: **▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%**

> Updated: 2026-09-05 — Phase 9 (Hardening) delivered: EF Core migrations replace EnsureCreated
> (safe baseline for legacy dev DBs), rate limiting, request audit log, core-invariant test suite,
> deployment guide. All 10 phases complete — v1 roadmap finished.

> Prior: Phase 8 (Frontend completion) delivered end-to-end and browser-verified.

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

## Phase 4 — Attendance (13%) ✅
- [x] Card-swipe check-in `POST /api/v1/attendance/check-in` with the full entry-validation pipeline (plan §2): member Active → no open visit → package Active / not frozen / not expired / sessions remaining / granted to the branch (via `ICatalogModule`), precise per-case errorCodes (`attendance.member_inactive|package_frozen|package_expired|no_sessions_remaining|branch_not_allowed|no_active_package`)
- [x] Atomic session consumption through `ISalesModule.TryConsumeSessionAsync` (one conditional `ExecuteUpdate WHERE SessionsUsed < SessionsTotal`); pre-validation is UX only, the UPDATE is the source of truth; FEFO package choice (soonest expiry first)
- [x] `AttendanceEntry` (memberId, memberPackageId, branchId, checkInAt, checkOutAt) + `AttendanceDbContext` (own SQLite file) with a partial unique index (`MemberId WHERE CheckOutAtUtc IS NULL`) — one open visit per member, enforced at the DB level
- [x] Branch derivation from JWT `branchId` claim (reception pinned) or explicit branchId (admin); concurrent-swipe backstop via unique-index `DbUpdateException` → 409
- [x] Check-out `POST /attendance/entries/{id}/check-out` · live presence board `GET /attendance/presence` (open visits + visitsToday, Staff policy) · paged history `GET /attendance` (search via `IMembersModule.FindIdsAsync` — no JOINs)
- [x] `IAttendanceModule` public contract (`IsMemberPresentAsync`, `GetForMemberAsync`) ready for Coaching/dashboards; demo seeds: 2 members in the gym now + 2 closed visits, resolved via public contracts
- [x] Frontend: Attendance workspace (stat chips, live presence card grid with 30 s auto-refresh + check-out, history table with search/branch filters + pager), rapid-swipe check-in dialog (stays open, inline success/denial panels, branch picker for admin / pinned label for reception), member sheet "visit history" section, dashboard phase-note → attendance link; fa/en + RTL + Jalali
- [x] Verified: eslint/tsc/next build clean; browser E2E — inactive denied, valid swipe consumes (3→4/12), duplicate denied, South-only Basic rejected @ North + accepted @ South, check-out closes board row, history/presence consistent, EN/LTR + mobile 390px; zero console errors

## Phase 5 — Wallet (10%) ✅
- [x] Top-up flow `POST /api/v1/wallet/members/{id}/top-up` (Management): member Active gate (`wallet.member_inactive|member_not_found`), amount > 0 (`wallet.invalid_amount`), branch from JWT claim (reception pinned) or explicit (admin) — check-in pattern; credit → TopUp receipt → ledger link, compensating debit if the receipt fails (mirror of the purchase flow)
- [x] `Receipt` promoted to the universal money document: `ReceiptKind.TopUp` + nullable `MemberPackageId`; new `ISalesModule.CreateTopUpReceiptAsync`; receipts list null-safe (TopUp rows show "—" for package) and reconcilable for end-of-day cash
- [x] `GET /api/v1/wallet/accounts` — paged accounts + `totalBalanceToman` KPI, search via `IMembersModule.FindIdsAsync`, enrichment via `GetBatchAsync`, last-activity from in-module join (zero cross-module JOINs)
- [x] `GET /api/v1/wallet/members/{id}/transactions` — paged ledger with kind filter; `IWalletModule.DebitAsync/CreditAsync` now return the ledger row id (non-breaking; used to link receipts)
- [x] WalletSeeder: opening balances now backed by real TopUp receipts (home branch) via the Sales contract — ledger ⇄ receipts reconcile exactly
- [x] Frontend: Wallet workspace (stat chips accounts/total-balance, Accounts tab paged+search, Ledger tab with member chip + kind filter + signed colored amounts + BalanceAfter column + pager), Top-up dialog (member search, branch pinned/picker, quick amount chips, note, inline success with new balance), member sheet wallet card (balance + last 3 rows + top-up shortcut), receipts tab TopUp rows, nav "wallet" (admin+reception), dashboard phase note → wallet; fa/en + RTL + Jalali
- [x] Verified: eslint/tsc/next build clean; browser E2E — top-up +1.5M → balance 2.5M exact, ledger BalanceAfter chain (3M→5M Sara, 1M→2.5M Maryam), receipts show TopUp rows with "—", total balance KPI 10.5M = Σ balances, EN/LTR + mobile 390px; zero console errors

## Phase 6 — Coaching (10%) ✅
- [x] `CoachAssignment` (coachId, memberId, branchId, releasedAt) + `TrainingPlan` (title/goal/content, auto-archive) + `TrainingRecord` (summary, duration, intensity, optional plan link) + `CoachingDbContext` (own SQLite file) with a partial unique index (`CoachId+MemberId WHERE ReleasedAtUtc IS NULL`) — one active pair, enforced at the DB level
- [x] Endpoints: POST /api/v1/coaching/assignments (Management; reception pinned to JWT branch) · GET /coaching/assignments (Staff; coach role forced to own rows+branch, active-first ordering) · POST /assignments/{id}/release (management or owning coach) · POST /coaching/plans (admin or coach; REQUIRES an active assignment `coaching.member_not_assigned`; auto-archives the author's previous active plan) · GET /coaching/plans · POST /plans/{id}/archive · POST /coaching/records (assignment-gated, plan link must match the pair, branch pinned/explicit) · GET /coaching/records · GET /coaching/coaches (active coach accounts + open-assignment counts via `IIdentityModule`) · GET /coaching/summary (KPIs incl. `membersPresentNow` consuming `IAttendanceModule.IsMemberPresentAsync` — the Phase 4 contract hook)
- [x] Role discipline: reception/buffet read-only on plans/records (`coaching.forbidden` 403); coach writes always self-scoped from the JWT `sub`; precise errorCodes (`coaching.coach_not_found|member_not_found|member_inactive|assignment_not_found|assignment_exists|already_released|member_not_assigned|plan_not_found|plan_not_active|record_not_found|forbidden`)
- [x] `ICoachingModule` public contract (`GetActiveForMemberAsync`) ready for Phase 8 dashboards; `IIdentityModule.GetCoachesAsync` added (non-breaking); coach.south operator added to Phase 1 seeds (fresh DBs)
- [x] CoachingSeeder: coach.north→Ali + →Maryam (active), coach.south→Sara (released history), Ali's Month-1 plan archived by Month-2 + Maryam's mobility plan, 5 training records resolved via public contracts
- [x] Frontend: Coaching workspace (4 KPI chips, Assignments/Plans/Records tabs, search + coach/branch/status filters + pager), AssignCoachDialog (coach select with open-pair counts, active-member search, branch pinned/picker), PlanDialog (assigned-members select, auto-archive note) + read-only plan content viewer, RecordDialog (plan link incl. archived plans, duration 1–600 gate, intensity Low/Med/High), release/archive AlertDialogs, dashboard phase note → coaching link; fa/en + RTL + Jalali
- [x] Verified: eslint/tsc/next build clean; browser E2E — duplicate pair rejected (`coaching.assignment_exists`), released pair re-assignable, plan create flipped Month-2 to Archived (exactly-one-active invariant), member selects list only assigned actives, record logged with plan link, coach login fully scoped (own KPIs 2/2/5/1 vs admin 3/2/5/2, no assign button, no coach/branch filters), EN/LTR + fa RTL + mobile 390px; zero console errors. Screenshots: download/gms-phase6-coaching-admin-fa.png, gms-phase6-coaching-fa.png, gms-phase6-mobile.png

## Phase 7 — Buffet (10%) ✅
- [x] `BuffetOrder` (memberId, branchId, paymentMethod Cash\|Wallet, server-computed totalToman, linked ReceiptId) + `BuffetOrderItem` (productId + name/price SNAPSHOTS at sale time — later catalog edits never rewrite history) + `BuffetDbContext` (own SQLite file) with in-module FK + indexes
- [x] POS order `POST /api/v1/buffet/orders` (new **Counter** policy: admin+reception+buffet): member Active gate, branch pinned from JWT claim (reception/buffet) or explicit (admin), per-branch price resolution via `ICatalogModule.GetProductAsync`, quantities 1–99 + duplicate-product merge, totals computed server-side (client never dictates money), cash XOR wallet (locked decision #5); wallet debits first (`BuffetPurchase` kind) with full compensation (order hard-delete + wallet credit-back) on any later failure; receipt created via `ISalesModule.CreateBuffetReceiptAsync` → order + ledger row linked (new `IWalletModule.LinkReceiptAsync`)
- [x] Paged history `GET /api/v1/buffet/orders` (search via `IMembersModule.FindIdsAsync` — no JOINs; reception/buffet pinned to own branch, admin sees the chain) · counter KPIs `GET /api/v1/buffet/summary` (orders today, revenue, cash/wallet split, UTC day, branch-scoped); errorCodes `buffet.member_not_found|member_inactive|items_empty|invalid_quantity|product_inactive|product_not_priced_in_branch`
- [x] Catalog product & per-branch price admin (locked decision #4): `POST/PUT /api/v1/catalog/products` (Admin) with name-duplicate guard, per-branch price validation via `IBranchesModule`, wholesale price replacement (upsert + drop, snapshots keep history); `ICatalogModule.GetProductsAsync` added (non-breaking)
- [x] `ReceiptKind.BuffetPurchase = 4` — receipts stay the universal money document (TopUp-style null package link); `IBuffetModule.GetForMemberAsync` contract ready for member sheet / Phase 8
- [x] BuffetSeeder (runs last): 3 demo orders — Ali wallet @ North yesterday (115,000 T), Sara cash @ South today (155,000 T), Maryam wallet @ North today (15,000 T) — wallet ledger ⇄ receipts reconcile exactly
- [x] Frontend: Buffet workspace (4 KPI chips, POS tab with member search + branch pinned/picker + product grid with per-branch prices + cart summary + cash/wallet toggle with live balance & insufficient guard + note, Orders tab with search/branch/method filters + pager + Jalali dates, admin-only Products tab with per-branch price columns), ProductDialog (create/edit with per-branch price inputs + field errors), nav "buffet" (Coffee, admin+reception+buffet — coaches excluded), receipts tab BuffetPurchase badge + filter, dashboard phase note → buffet
- [x] Verified: eslint/tsc/next build clean; browser E2E — buffet.north login sees a scoped workspace (North-pinned, no products tab), wallet order 2×water+1×bar = 115,000 T → balance 2,385,000→2,270,000 exact, ledger + receipts reconcile (total held 8,755,000 = Σ balances), insufficient-wallet guard blocks an oversized cart inline, cash order 1×water via UI, product "Isotonic Drink" created 70,000/75,000 per branch and instantly sellable, receipts show BuffetPurchase rows, EN/LTR + fa RTL + mobile 390px; zero console errors. Screenshots: download/gms-phase7-buffet-admin-fa.png, gms-phase7-buffet-buffetrole-fa.png, gms-phase7-buffet-admin-en.png, gms-phase7-buffet-mobile.png

## Phase 8 — Frontend completion (10%) ✅
- [x] Sales KPI endpoint `GET /api/v1/sales/summary` (Management; reception pinned to JWT branch, admin whole-chain/explicit): active member packages, package revenue today with cash/wallet split, top-ups today, refunds today, month-to-date revenue/refunds — in-module queries only
- [x] Dashboard v2 (role-aware workspaces): admin/reception see 8 KPI cards (members, presence, active packages, package revenue, wallet held, buffet revenue) + month line; buffet sees a counter board (presence/visits/buffet orders+revenue+split, branch-pinned); coach sees their own coaching KPIs (assignments/plans/7-day sessions/presence) — each role's cards only call endpoints its role may hit (Promise.allSettled, graceful partial failure)
- [x] Quick actions row per role (management: new member / sell / top-up dialogs + check-in & POS & coaching views; buffet: POS; coach: coaching) — dialogs reused from the existing page-level wiring
- [x] Reports tab (admin+reception): Today panel (visits, package revenue with payment split, top-ups, refunds, buffet orders/revenue), This-month panel (package revenue, refunds, wallet held), recent receipts table with kind badges + Jalali dates
- [x] Member file completion: Active-coach section (via the member-scoped assignment search) + buffet orders section (last 3, snapshot item names, payment method, Jalali dates) — consumes the Phase 6/7 contracts through existing endpoints; wallet section already shows BuffetPurchase ledger rows
- [x] Jalali/RTL polish: dashboard built RTL-first with Persian digit formatting (formatNumber) on every counter, tabular-nums + dir-safe money cells, Jalali dates throughout reports/receipts; phase note updated to Phase 8
- [x] Demo adapter kept contract-exact: demoGetSalesSummary mirrors the endpoint (UTC day/month windows, branch scoping, payment split); DB key bumped to v8 for fresh seeds
- [x] Verified: eslint/tsc/next build clean; browser E2E — admin overview 8/8 KPIs exact (4 members, 2 present, 3 active packages, 0 today revenue, wallet held 8,870,000 = Σ balances, buffet 170,000) and reports tab numbers reconciled to the receipt list; coach.north sees own 2/2/4/1 KPIs with no reports tab; buffet.north sees North-scoped 1/1/1/15,000; member sheet shows coach + buffet history for Maryam and Ali; fa RTL + EN + mobile 390px; zero console errors. Screenshots: download/gms-phase8-dashboard-admin-fa.png, gms-phase8-reports-admin-fa.png, gms-phase8-mobile.png

## Phase 9 — Hardening (5%) ✅
- [x] **EF migrations replace EnsureCreated**: hand-authored Initial migration + model snapshot for all 10 contexts (9 modules + new Audit DB, `20260905080001…10_Initial`); boot bootstrap per DB — fresh file → `MigrateAsync`; legacy EnsureCreated file (tables, no history) → migrations **stamped as applied** (baseline, schema untouched); already-migrated → applies pending. History table name/product version match EF conventions (8.0.11)
- [x] Catalog model made deterministic before shipping migrations: explicit in-module FKs (`PackageBranchAccess.PackageId → Packages`, `BuffetProductPrices.ProductId → BuffetProducts`, cascade) instead of convention shadow FKs — EnsureCreated output now matches the migrations exactly
- [x] **Rate limiting**: global token bucket (200 tokens, +100/10 s) per userId/IP + strict per-IP fixed window (10/min) on `POST /api/v1/identity/login` (brute-force guard); 429 → RFC7807 ProblemDetails with `errorCode: rate_limit.exceeded` + `Retry-After`; limits ops-tunable via `RateLimiting` appsettings section
- [x] **Audit log**: every mutating request (POST/PUT/PATCH/DELETE under `/api`) recorded to `gms-audit.db` (own SQLite file) — user/role/branch from JWT, method/path/status/duration/IP + password-redacted JSON body snapshot (64 KB capture cap, 4 KB store cap, non-JSON skipped); audit failures swallowed + logged (never break the API); `GET /api/v1/audit` paged trail (Admin) with action/userId filters
- [x] **Tests**: `backend/tests/Gms.Core.Tests` (xUnit, wired into Gms.sln) — wallet ledger BalanceAfter chain + insufficient-balance/non-positive guards + account-on-demand (real SQLite via `IWalletModule`), atomic session consumption (last-session oversell rejected, frozen/refunded/expired denied), pro-rata refund math incl. floor cases, freeze-shift math (ceiling, clock-skew safe), PBKDF2 hasher roundtrip/malformed-hash rejection; `SalesMath` extracted from endpoints (behavior-preserving) as the tested pure core
- [x] **Deploy docs**: `download/gms-deployment.md` (config checklist, migration/baseline behavior, WAL backups, publish + systemd + reverse proxy, smoke checklist, audit ops, rollback) + backend README refreshed (migration table, `dotnet ef` workflow via `.config/dotnet-tools.json`, test command)
- [x] Verified: static review pass over all C# changes (usings, API signatures, EF translation-safe projections); JSON configs valid; no frontend changes needed (Phase 9 scope is backend/ops); frontend build artifacts untouched at Phase 8 state
