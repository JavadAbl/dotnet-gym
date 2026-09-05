# GMS Backend — ASP.NET Core 8 Modular Monolith

## Run (requires .NET 8 SDK — not available in the sandbox, run locally)

```bash
cd backend
dotnet tool restore        # restores dotnet-ef 8.0.11 from .config/dotnet-tools.json
dotnet restore
dotnet run --project src/Api/Gms.Api
# Swagger UI: http://localhost:5000/swagger
```

First start creates `data/*.db` (one SQLite file per module + audit, WAL enabled), applies
EF Core migrations (Phase 9), and seeds:

| Seed | Detail |
|---|---|
| Users | `admin / Admin@123` · `reception.north`, `reception.south`, `buffet.north`, `coach.north`, `coach.south` / `Operator@123` |
| Branches | North Branch (شعبه شمال) · South Branch (شعبه جنوب) |
| Packages | VIP 12 sessions / 30 days / 2,500,000 T (both branches) · Basic 8 / 14 / 1,200,000 T (South only) |
| Buffet | Water 15,000 T · Protein Bar 85,000 T N / 95,000 T S · Energy Drink 60,000 T |
| Demo members | M-00001 … M-00004 (علی محمدی، سارا کریمی، رضا حسینی، مریم احمدی) |

## Database schema — EF Core migrations (Phase 9)

Schema creation is migration-driven (`Database.MigrateAsync` at boot, per module database).
Every context ships a hand-authored `Initial` migration + model snapshot under
`Infrastructure/Migrations/`:

| Context | Migration id | Tables |
|---|---|---|
| IdentityDbContext | 20260905080001_Initial | Users |
| BranchesDbContext | 20260905080002_Initial | Branches |
| MembersDbContext | 20260905080003_Initial | Members |
| CatalogDbContext | 20260905080004_Initial | Packages, PackageBranchAccess, BuffetProducts, BuffetProductPrices |
| SalesDbContext | 20260905080005_Initial | MemberPackages, PackageFreezes, Refunds, Receipts |
| WalletDbContext | 20260905080006_Initial | WalletAccounts, WalletTransactions |
| AttendanceDbContext | 20260905080007_Initial | AttendanceEntries |
| CoachingDbContext | 20260905080008_Initial | CoachAssignments, TrainingPlans, TrainingRecords |
| BuffetDbContext | 20260905080009_Initial | BuffetOrders, BuffetOrderItems |
| AuditDbContext | 20260905080010_Initial | AuditRecords |

Upgrade paths handled automatically at startup:

- **Fresh database** → `MigrateAsync` applies the migrations.
- **Legacy EnsureCreated database** (Phases 0–8 dev DBs: tables exist, no `__EFMigrationsHistory`)
  → all defined migrations are **stamped as applied** (baseline) and the schema is left untouched.
- **Already-migrated database** → pending migrations apply; today that is a no-op.

Adding the next migration later:

```bash
cd backend
dotnet ef migrations add <Name> --project src/Modules/Sales/Gms.Modules.Sales \
    --startup-project src/Api/Gms.Api --context SalesDbContext --output-dir Infrastructure/Migrations
dotnet run --project src/Api/Gms.Api     # applies it on boot
```

Note for baselined (pre-Phase 9) databases: because the baseline stamps the schema as-is,
a later migration that ALTERs schema may emit spurious ops for those databases — for
production, deploy against a fresh database (see `docs` deployment guide) or recreate
legacy dev DBs by deleting `data/*.db` (seeds rebuild them).

## Hardening features (Phase 9)

- **Rate limiting** — global token bucket (200 tokens, +100 per 10 s) per user/IP, plus a
  strict per-IP fixed window (10/min) on `POST /api/v1/identity/login`. Rejections return
  RFC7807 with `errorCode: rate_limit.exceeded` and a `Retry-After` header. Tune via the
  `RateLimiting` section in `appsettings.json`.
- **Audit log** — every mutating API request (POST/PUT/PATCH/DELETE under `/api`) is recorded
  to `data/gms-audit.db`: user, role, branch, method, path, status, duration, IP and a
  password-redacted JSON body snapshot. Inspect with `GET /api/v1/audit` (admin only).
- **Tests** — `backend/tests/Gms.Core.Tests` (xUnit) pins the core invariants: wallet ledger
  BalanceAfter chain + guards, atomic session consumption, pro-rata refund math, freeze-shift
  math, PBKDF2 password hashing. Run with:

  ```bash
  dotnet test backend/Gms.sln
  ```

## API surface

```
POST /api/v1/identity/login                (anon, rate-limited)  → JWT (sub, role, branchId)
GET  /api/v1/identity/me                   (staff)
GET  /api/v1/branches                      (staff)   POST/PUT (admin)
GET  /api/v1/catalog/packages[...]         (staff)   POST /api/v1/catalog/packages (admin)
GET  POST /api/v1/catalog/products         (GET staff, POST/PUT admin — per-branch prices)
GET  /api/v1/members?search&status&...     (staff)   POST/PUT/POST status (admin|reception)
POST /api/v1/sales/member-packages         (management — cash XOR wallet)
GET  /api/v1/sales/member-packages[...]    (management)  POST {id}/freeze|unfreeze|refund
GET  /api/v1/sales/receipts                (management)  GET /api/v1/sales/summary
POST /api/v1/attendance/check-in           (management — entry validation + atomic consume)
POST /api/v1/attendance/entries/{id}/check-out · GET /attendance/presence · GET /attendance
GET  /api/v1/wallet/accounts               (management)  POST /api/v1/wallet/members/{id}/top-up
GET  /api/v1/wallet/members/{id}/transactions
POST /api/v1/coaching/assignments|plans|records (+ release/archive, coaches, summary)
POST /api/v1/buffet/orders                 (counter)  GET /api/v1/buffet/orders|summary
GET  /api/v1/audit                         (admin)
GET  /api/v1/health                        (anon)
```

Errors: RFC7807 `application/problem+json` with `errorCode` (e.g. `member.phone.duplicate`) and optional `errors` field map.

## Module rules (enforced by convention)

- One EF Core `DbContext` + one SQLite file per module; cross-module data ONLY via `*.Public` contracts.
- No cross-module FKs/JOINs; ids are stored and resolved through contract calls.
- No AutoMapper — hand-written `ToDto()` extensions.
- Money = `long` Toman; timestamps UTC.
- Auth claims: `sub` (userId), `role` (admin|reception|buffet|coach), `branchId` (when applicable).
