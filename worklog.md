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
