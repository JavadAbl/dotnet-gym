# GMS Worklog (append-only)

---
Task ID: R-0
Agent: main (Super Z)
Task: Restore continuity after workspace reset (docs)

Work Log:
- Detected workspace reset: only initial commit remained; all GMS artifacts lost.
- Recreated download/gms-implementation-plan.md (v1.1), gms-progress.md, gms-agents-guide.md, AGENTS.md.
- Initialized Next.js fullstack environment via init script.

Stage Summary:
- Continuity anchors restored; phases 0–1 marked "rebuilt" in tracker.

---
Task ID: 2 (Phase 2 — Members module)
Agent: main (Super Z)
Task: Implement Phase 2 (Members) on rebuilt Phase 0/1 foundation after workspace reset

Work Log:
- Detected full workspace reset; recreated planning docs (implementation plan v1.1, progress tracker, agents guide, AGENTS.md) and initialized the Next.js environment.
- Rebuilt backend/ .NET solution: Gms.sln (20 projects), Directory.Build.props, Gms.BuildingBlocks (Entity, GmsException, ErrorCodes, Policies/UserRoles, SQLite WAL bootstrapper).
- Rebuilt Phase 1: Identity module (PBKDF2 PasswordHasher, TokenService with role/branchId claims, login + me endpoints, seeded admin + 4 operators), Branches module (North/South + CRUD), Catalog module (VIP both branches @2.5M T, Basic South-only @1.2M T, 3 buffet products with per-branch prices).
- Implemented Phase 2 Members module: Member entity (auto code M-00005 style, card code, status Active/Inactive/Blocked), MembersDbContext with filtered unique indexes (phone/card), endpoints: POST /api/v1/members, GET search (paged: search/status/branchId), GET/PUT {id}, POST {id}/status; shared validation with duplicate guards -> member.phone.duplicate / member.card.duplicate; demo member seeds resolved via IBranchesModule contract.
- Wired API host: JWT bearer validation, policies (Admin/Management/Staff), GmsExceptionHandler -> ProblemDetails + errorCode, Swagger with bearer scheme, deterministic seed order (branches -> identity -> catalog -> members).
- Frontend: RTL fa-first single-route admin app — login view with demo accounts, dashboard (live stats), Members workspace (debounced search, status/branch filters, paged table, create/edit dialog with server field-error mapping, detail sheet with status actions), Packages & Branches views, fa/en toggle with dir switch, Jalali/Gregorian date rendering, Toman formatting; demo adapter (localStorage, same API contract) + real API mode via NEXT_PUBLIC_GMS_API_BASE.
- Verified: eslint clean; agent-browser E2E — login, dashboard stats, member create (M-00005), status change persisted, code search, empty state, fa/en toggle, packages/branches views, mobile 390px layout; no console errors.

Stage Summary:
- Phase 0 (rebuilt), Phase 1 (rebuilt), Phase 2 complete. Weighted progress 27%.
- Backend runs locally: cd backend && dotnet run --project src/Api/Gms.Api (login admin/Admin@123).
- Frontend preview runs in sandbox on :3000 (demo mode); real API via NEXT_PUBLIC_GMS_API_BASE.
- Next: Phase 3 — Sales module (package purchase receipts cash/wallet, member packages, freeze/unfreeze, refunds).

---
Task ID: 3 (Phase 3 — Sales module)
Agent: main (Super Z)
Task: Implement Phase 3 (Sales) per gms-implementation-plan.md v1.1 roadmap

Work Log:
- Implemented Sales module (modular monolith, own SQLite DB): entities MemberPackage (sessions/expiry/status Active|Frozen|Refunded), PackageFreeze, Refund, Receipt (single payment method per receipt — locked decision #5); SalesDbContext with indexes; hand-written mappings (no AutoMapper).
- Endpoints: POST /api/v1/sales/member-packages (validates member Active, branch, package availability via public contracts; cash XOR wallet; wallet debits first with compensating credit if persist fails), GET paged search (search via IMembersModule.FindIdsAsync — no cross-module JOIN), GET {id} detail (freezes+refund+receipts), freeze/unfreeze (unfreeze shifts expiry by ceil(frozen days) — locked decision #6), refund (pro-rata unused-sessions default, amount override guard, mirrors original payment method; wallet refunds credit the wallet with compensating debit), GET /api/v1/sales/receipts.
- Pulled Wallet minimal core forward from Phase 5 (required for wallet payments): WalletAccount/WalletTransaction with BalanceAfter ledger invariant, IWalletModule contract (snapshot/ensure/debit/credit/recent), GET /api/v1/wallet/members/{id}, opening-balance seeds resolved via card codes.
- Extended IMembersModule with GetBatchAsync + FindIdsAsync (batch enrichment + member-scoped search without JOINs); implemented in MembersModuleApi.
- ISalesModule public contract: GetMemberPackageAsync, GetForMemberAsync, TryConsumeSessionAsync (atomic ExecuteUpdate WHERE Status=Active AND Expires>now AND SessionsUsed<SessionsTotal) — ready for Phase 4.
- Seeds: 5 demo member packages (Ali wallet VIP, Sara cash Basic, Reza FROZEN VIP, Maryam cash VIP, Ali REFUNDED Basic with 750,000 pro-rata refund receipt); wallet ledger kept consistent (RF-0001: TopUp 5M → purchase −2.5M → balance 2.5M).
- API host: Sales/Wallet connection strings (own .db files), DI, endpoint maps, WAL bootstrap, seed order branches→identity→catalog→members→wallet→sales.
- Fixed three latent Phase 0 compile blockers (backend never compiled in sandbox): added backend/Directory.Build.props (net8.0 + ImplicitUsings + Nullable — csprojs had NO TargetFramework), added Microsoft.Extensions.DependencyInjection global using to all module GlobalUsings.cs (IServiceCollection unresolved), added Sales+Wallet ProjectReferences to Gms.Api.csproj.
- Frontend: types + demo-store v3 (memberPackages/receipts/walletAccounts/walletTransactions, seed mirror of backend), demo-sales adapter mirroring endpoints + errorCodes exactly, api client (7 sales/wallet functions), i18n +~85 fa/en keys, Sales workspace (packages+receipts tabs, filters, session progress, row action menus), SellPackageDialog (member search, branch-scoped package select, wallet balance + insufficient guard), RefundDialog (pro-rata prefill, editable amount, original-method note), member detail sheet real packages + sell shortcut, nav "sales" (ReceiptText), dashboard phase note updated.
- Verified: eslint clean, tsc clean (GMS sources), next build passes; agent-browser E2E: freeze→frozen, unfreeze→active, wallet purchase (ledger exact 5M→2.5M→0), refund (wallet credit back to 2.5M, PackageRefund row), receipts tab newest-first, member sheet packages, EN/LTR switch, mobile 390px screenshot; zero console errors. Screenshots in download/.

Stage Summary:
- Phase 3 complete. Weighted progress 27% → 42%.
- Backend: cd backend && dotnet run --project src/Api/Gms.Api (admin/Admin@123) — sales + wallet endpoints under /api/v1 (Swagger UI at /swagger).
- Frontend preview on :3000 (demo mode, DB key bumped to gms.demo.db.v3 → fresh seeds); real API via NEXT_PUBLIC_GMS_API_BASE.
- Next: Phase 4 — Attendance (card-swipe check-in, entry validation, TryConsumeSessionAsync integration, live presence board, history).

---
Task ID: 4 (Phase 4 — Attendance module)
Agent: main (Super Z)
Task: Implement Phase 4 (Attendance) per gms-implementation-plan.md v1.1 roadmap

Work Log:
- Implemented Attendance module (own SQLite DB gms-attendance.db): entity AttendanceEntry (memberId, memberPackageId, branchId, checkInAtUtc, checkOutAtUtc); AttendanceDbContext with indexes + partial unique index (MemberId WHERE CheckOutAtUtc IS NULL) enforcing one open visit per member at DB level.
- Check-in endpoint POST /api/v1/attendance/check-in (Management policy): card-code → branch resolution (JWT branchId claim pins reception/coach; admin passes explicit branchId) → member lookup via IMembersModule.GetByCardCodeAsync → member Active gate → open-visit gate → package gate (Active + not expired + sessions remaining via ISalesModule.GetForMemberAsync, branch access via ICatalogModule.IsPackageAvailableInBranchAsync — contract calls only, zero cross-module JOINs). Precise denial errorCodes: attendance.member_not_found | member_inactive | already_checked_in | package_frozen | package_expired | no_sessions_remaining | branch_not_allowed | no_active_package. FEFO package choice (earliest expiry first).
- Session consumption = ISalesModule.TryConsumeSessionAsync (Phase 3 atomic ExecuteUpdate WHERE Status=Active AND Expires>now AND SessionsUsed<SessionsTotal) — pre-validation is UX only, the conditional UPDATE is the source of truth; race lost → attendance.entry_conflict (409). Concurrent same-member swipe backstop: unique-index DbUpdateException → 409 already_checked_in (consumed-session tradeoff documented in code).
- Endpoints: POST /attendance/entries/{id}/check-out (409 already_checked_out) · GET /attendance/presence (open visits + visitsToday, Staff policy — coaches/buffet can watch the board) · GET /attendance paged history (search via IMembersModule.FindIdsAsync, memberId/branchId filters). IAttendanceModule public contract: IsMemberPresentAsync + GetForMemberAsync (for Coaching/dashboards). Enriched AttendanceEntryView (member/package/branch names + live sessions remaining) via public-contract lookups, hand-written mappings.
- AttendanceSeeder (runs after SalesSeeder): Maryam + Sara currently in the gym (open entries), Ali closed visit yesterday (VIP @ North) + 3 days ago (Basic @ South), all resolved via public contracts; Reza intentionally absent (Inactive + frozen package = the "denied" demo story).
- API host: Attendance connection string, AddAttendanceModule/MapAttendanceEndpoints, WAL bootstrap entry, seed order …sales→attendance; Api.csproj project ref.
- Frontend: types (AttendanceEntry/PresenceBoard/CheckInRequest/AttendanceQuery); demo-store v4 (DB key bumped, attendance store + seed mirror); demo-attendance adapter mirroring endpoints + errorCodes exactly (incl. denial precedence classifier); api client checkIn/checkOut/getPresence/searchAttendance.
- Attendance workspace: stat chips (present now / visits today), presence card grid (30 s auto-refresh, per-card check-out, pulsing "present" badge), history tab (search + branch filters, pager, duration formatting fa/en), rapid-swipe CheckInDialog (stays open for successive swipes, inline green success panel with member/package/remaining + red denial panel, autofocus card input, branch picker for admin vs pinned label for reception). Member sheet gained a VISIT HISTORY section (last 5 visits); dashboard phase note updated to Phase 4 with attendance shortcut; nav "attendance" (ScanLine).
- i18n: +~70 fa/en keys (attendance.*, checkin.*, errors.attendance.*).
- Verified: eslint clean, tsc clean (GMS sources), next build passes; agent-browser E2E: inactive member denied, Ali RF-0001 @ North accepted (3→4/12 used, remaining 8), duplicate swipe → already_checked_in, Sara's South-only Basic rejected @ North (branch_not_allowed) then accepted @ South (2→3/8, remaining 5), check-out closes board row + toast, presence stats 3 present / 4 visits today, history rows exact (Jalali dates, "۲ ساعت و ۰ دقیقه" durations), member sheet visits, EN/LTR switch, mobile 390px; zero console errors. Screenshots: download/gms-phase4-attendance.png, download/gms-phase4-mobile.png.

Stage Summary:
- Phase 4 complete. Weighted progress 42% → 55%.
- Backend: cd backend && dotnet run --project src/Api/Gms.Api (admin/Admin@123) — attendance endpoints under /api/v1 (Swagger UI at /swagger).
- Frontend preview on :3000 (demo mode, DB key gms.demo.db.v4 → fresh attendance seeds); real API via NEXT_PUBLIC_GMS_API_BASE.
- Next: Phase 5 — Wallet completion (top-up endpoint/receipt UI; core ledger already pulled forward in Phase 3).

---
Task ID: 5 (Phase 5 — Wallet module)
Agent: main (Super Z)
Task: Implement Phase 5 (Wallet) per gms-implementation-plan.md v1.1 roadmap

Work Log:
- Sales module extension (contained): Receipt promoted to the universal money document — ReceiptKind.TopUp = 3, MemberPackageId → Guid? (TopUp rows untied to packages); ReceiptView.MemberPackageId → Guid?; ListReceiptsEndpoint null-safe package enrichment (TopUp shows "—"); new ISalesModule.CreateTopUpReceiptAsync (validates amount > 0 → wallet.invalid_amount, persists Kind=TopUp + PaymentMethod=Cash) returning ReceiptCreatedDto.
- Wallet module completion: POST /api/v1/wallet/members/{id}/top-up (Management) — member gate (new errorCodes wallet.member_not_found / wallet.member_inactive), amount > 0, branch from JWT branchId claim (reception pinned) or explicit branchId (admin) mirroring the check-in endpoint; orchestration = CreditAsync → CreateTopUpReceiptAsync → link ledger row RelatedReceiptId via ExecuteUpdate; catch → compensating DebitAsync (note explains) then rethrow — mirror image of the Phase 3 purchase flow.
- GET /api/v1/wallet/accounts (Management): paged + WalletAccountsPage envelope with totalBalanceToman KPI; search via IMembersModule.FindIdsAsync (no cross-module JOIN); enrichment via GetBatchAsync; last activity per account from in-module WalletTransactions group-join; ordered balance desc.
- GET /api/v1/wallet/members/{id}/transactions (Management): paged ledger, kind filter via Enum.TryParse; missing account → empty page (UI offers top-up). IWalletModule.DebitAsync/CreditAsync now return Task<Guid> (ledger row id) — non-breaking for Sales callers.
- WalletSeeder: opening balances now credit → TopUp receipt (home branch) → link, so the receipts list reconciles with the ledger exactly; Gms.Modules.Wallet.csproj gained a Sales.Public project reference (contract-only, no cycle).
- Frontend: types (WalletAccountRow, WalletAccountsPage, WalletTransactionsQuery, TopUpRequest/Response; Receipt.memberPackageId nullable + kind "TopUp"); demo-store v5 (DB key bump; opening balances now create linked TopUp receipts; seedDemoWallet adds Sara's desk top-up +2M → 5M); new demo-wallet.ts adapter mirroring endpoints + errorCodes (fixed a TDZ bug: last-activity Map self-reference → for-loop); api client: listWalletAccounts / listWalletTransactions / topUpWallet.
- Wallet workspace: stat chips (accounts count, total balance held), Accounts tab (debounced search, paged table sorted by balance, per-row ledger shortcut), Ledger tab (member chip with live balance + kind filter + pager, rows with kind badges, signed colored amounts, BalanceAfter column), TopUpDialog (member search, branch pinned label for reception vs picker for admin, quick amount chips 500k/1M/2M/5M, note, inline success panel with new balance). Member sheet gained a Wallet card (balance + last 3 ledger rows + top-up shortcut with preset member). Sales receipts tab: TopUp filter option + sky badge + "—" package column. Nav "wallet" (Wallet icon, admin+reception), dashboard phase note → wallet link. i18n +~60 fa/en keys.
- Verified: eslint clean; tsc clean (GMS sources; fixed lucide WalletPlus → CirclePlus); next build passes; agent-browser E2E: top-up Maryam +1.5M @ North → new balance 2.5M shown inline and in store (2500000,5000000,500000,2500000), Sara ledger chain 3M→5M exact with BalanceAfter, receipts tab lists TopUp rows (شارژ/نقدی/—), total-balance KPI 10.5M = Σ balances, EN→LTR switch, fa RTL + mobile 390px screenshots (download/gms-phase5-wallet-fa.png, gms-phase5-wallet.png, gms-phase5-mobile.png); zero console errors.

Stage Summary:
- Phase 5 complete. Weighted progress 55% → 65%.
- Backend: cd backend && dotnet run --project src/Api/Gms.Api (admin/Admin@123) — wallet endpoints under /api/v1 (Swagger UI at /swagger); Receipts = universal money document (purchases, refunds, top-ups).
- Frontend preview on :3000 (demo mode, DB key gms.demo.db.v5 → fresh seeds with linked TopUp receipts); real API via NEXT_PUBLIC_GMS_API_BASE.
- Wallet payments already serve Sales (Phase 3); Buffet wallet payments arrive in Phase 7 via the same IWalletModule contract (Kind=BuffetPurchase reserved).
- Next: Phase 6 — Coaching (coach assignments, training plans, training records, coach workspace).

---
Task ID: 6 (Phase 6 — Coaching module)
Agent: main (Super Z)
Task: Implement Phase 6 (Coaching) per gms-implementation-plan.md v1.1 roadmap

Work Log:
- Verified baseline first: progress tracker + worklog showed Phases 0–5 complete (65%); Phase 6 = Coaching (assignments, plans, records, coach workspace; no commissions — locked decision #8).
- Identity extension (contract-only): IIdentityModule.GetCoachesAsync (active coach accounts, non-breaking); IdentitySeeder gained coach.south operator (fresh DBs) so both branches have coaches.
- Coaching module (own SQLite DB gms-coaching.db): entities CoachAssignment (coachId, memberId, branchId, releasedAt, note), TrainingPlan (title/goal/content, isActive, archivedAt), TrainingRecord (summary, durationMinutes, intensity Low|Medium|High, optional in-module plan link); CoachingDbContext with partial unique index (CoachId+MemberId WHERE ReleasedAtUtc IS NULL) enforcing one active pair at the DB level; hand-written mappings.
- Endpoints: POST /api/v1/coaching/assignments (Management; coach must be active via contract, member Active gate, branch pinned from JWT or explicit for admin, duplicate gate + DbUpdateException backstop → coaching.assignment_exists 409); GET /coaching/assignments (Staff; coach role forced coachId=self + branch=self, active-first ordering, search via IMembersModule.FindIdsAsync, live presence badges via IAttendanceModule.IsMemberPresentAsync per page); POST /assignments/{id}/release (management or owning coach; already_released 409); POST /coaching/plans (EnsureCoachOrAdmin 403 for reception/buffet; coach self-scoped from sub; REQUIRES active assignment → coaching.member_not_assigned; auto-archives the author's previous active plan); GET /coaching/plans; POST /plans/{id}/archive; POST /coaching/records (assignment-gated, plan link must belong to the pair, duration 1–600 + intensity whitelist + no-future-time validation, branch pinned/explicit); GET /coaching/records; GET /coaching/coaches (coach list + open-pair counts); GET /coaching/summary (scoped KPIs; membersPresentNow consumes the Phase 4 IAttendanceModule hook, bounded to 100 pairs).
- ErrorCodes: 11 new coaching.* codes; GmsException → ProblemDetails + errorCode everywhere.
- Wiring: Coaching csproj references only BuildingBlocks + Identity/Members/Branches/Attendance .Public contracts; Api csproj ref, appsettings Coaching connection string, AddCoachingModule/MapCoachingEndpoints, WAL bootstrap entry, seed order …attendance→coaching; CoachingSeeder (2 active + 1 released assignment, Month-1-archived-by-Month-2 + mobility plans, 5 records, all resolved via public contracts).
- Frontend: types (Coach/CoachAssignment/TrainingPlan/TrainingRecord/CoachingSummary + queries/requests); demo-store v6 (DB key bump; coach.south user; coaching collections + seedDemoCoaching mirror); demo-coaching adapter mirroring endpoints + errorCodes exactly (assignment-gates, auto-archive, presence resolved from the attendance store); api client +10 coaching functions; i18n +~115 fa/en keys (incl. errors.coaching.*); dashboard phase note → coaching.
- Coaching workspace: KPI chips (active members / active plans / sessions 7d / present now), tabs Assignments/Plans/Records, debounced member search, coach+branch+status filters (admin) vs pinned scope (coach), AssignCoachDialog (coach select with open-pair counts, active-member search, branch pinned/picker), PlanDialog + PlanContentDialog (pre-wrap viewer), RecordDialog (plan link incl. archived, duration gate, intensity), release/archive AlertDialogs; nav "coaching" (ClipboardList) for all staff roles; coach role sees hint banner and no assign button.
- Fixed during E2E: missing coaching.column.plan i18n key (raw key in records header), coach-filter "all" label, unused-import/dead-code cleanups in new components.
- Verified: eslint clean, tsc clean (GMS sources), next build passes; agent-browser E2E: duplicate pair rejected with localized error (store row count unchanged 3), released pair re-assigned (4 rows, KPI 3), plan create flipped Month-2 → Archived (exactly-one-active), member selects list only assigned actives, session logged with Month-3 plan link + 60min + High, coach.north login fully scoped (KPIs 2/2/5/1 vs admin 3/2/5/2, no assign button/filters), fa RTL + Jalali + EN/LTR + mobile 390px screenshots (download/gms-phase6-coaching-admin-fa.png, gms-phase6-coaching-fa.png, gms-phase6-mobile.png); zero console errors.

Stage Summary:
- Phase 6 complete. Weighted progress 65% → 75%.
- Backend: cd backend && dotnet run --project src/Api/Gms.Api (admin/Admin@123, coach.north/coach.south Operator@123) — coaching endpoints under /api/v1 (Swagger UI at /swagger).
- Frontend preview on :3000 (demo mode, DB key gms.demo.db.v6 → fresh coaching seeds); real API via NEXT_PUBLIC_GMS_API_BASE.
- ICoachingModule.GetActiveForMemberAsync ready for Phase 8 dashboards; member-sheet coach section is a candidate polish item.
- Next: Phase 7 — Buffet (products & per-branch price admin, POS order cash/wallet; Kind=BuffetPurchase ledger kind reserved).
