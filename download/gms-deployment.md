# GMS — Deployment & Operations Guide (Phase 9)

> Applies to GMS v1.1 (all phases complete). Audience: whoever stands the system up in a
> real environment — a single Windows/Linux box per site is sufficient for v1.

## 1. Prerequisites

| Component | Version | Notes |
|---|---|---|
| .NET SDK | 8.0.x | builds + runs the API (`backend/`) |
| Node.js | 20+ | builds the operator UI (Next.js, repo root) |
| SQLite | bundled | no server to install; files live in `data/` |

The sandbox has no .NET SDK — build and run happen on the target machine.

## 2. Configuration checklist (before first boot)

All settings live in `backend/src/Api/Gms.Api/appsettings.json` (override per environment
with `appsettings.Production.json` or environment variables, e.g. `ConnectionStrings__Sales`).

1. **JWT signing key (mandatory)** — replace `Jwt:Key` with a production secret
   (≥ 64 random chars). The shipped value is explicitly dev-only. Operators re-login every
   `Jwt:ExpiresMinutes` (default 480).
2. **Connection strings** — one SQLite file per concern:
   `Identity, Branches, Catalog, Members, Sales, Wallet, Attendance, Coaching, Buffet, Audit`
   (default `data/gms-<name>.db`). Point them to a persistent volume — **not** a temp dir.
3. **Rate limits** — `RateLimiting` section: global token bucket
   (`GlobalTokenLimit` 200 / `GlobalTokensPerPeriod` 100 per `GlobalReplenishSeconds` 10)
   and the login guard (`LoginPermitLimit` 10 per `LoginWindowSeconds` 60 per IP).
   Tighten the login window for internet-exposed deployments.
4. **CORS** — the default policy is allow-all for v1 internal use. If the UI is served from
   a different origin on an untrusted network, restrict origins before exposing.
5. **Logging** — `Microsoft.EntityFrameworkCore: Warning` keeps boot quiet; raise to
   `Information` temporarily to watch migrations/SQL.

## 3. Database strategy

### 3.1 Schema — EF Core migrations

Schema is created and versioned by EF Core migrations (Phase 9). At boot the API, per
database:

1. fresh file → applies the shipped `Initial` migrations;
2. file with tables but no `__EFMigrationsHistory` (legacy EnsureCreated dev DB) → stamps
   migrations as applied (baseline) and leaves the schema alone;
3. migrated file → applies any pending migrations.

For production, deploy against a **fresh** `data/` directory so the history table and the
schema are guaranteed consistent. Legacy dev databases are fine for development; recreate
them (`delete data/*.db`, seeds rebuild) if you plan to author further migrations against them.

### 3.2 Seeds

First boot seeds operators (`admin/Admin@123`, `reception.*`, `buffet.*`, `coach.*` /
`Operator@123`), branches, packages, buffet products, demo members and demo documents.
**Change all seed passwords immediately after go-live** (or trim the seeders for production).
Seeding is idempotent — it only fills what is missing.

### 3.3 SQLite + WAL

`PRAGMA journal_mode=WAL` is enforced once per database at startup, plus `busy_timeout`
5 s. Operational notes:

- Back up by file copy **after** a checkpoint, or use `sqlite3 gms-sales.db "VACUUM INTO 'backup/gms-sales-$(date +%F).db'"`.
- WAL leaves `*-wal` / `*-shm` siblings next to each `.db` — back up the triple together
  (or checkpoint first: `PRAGMA wal_checkpoint(TRUNCATE);`).
- v1 is single-instance per database set. Do NOT share the `data/` directory between
  replicas; SQLite is the write bottleneck by design.

## 4. Build & run

### 4.1 API

```bash
cd backend
dotnet tool restore
dotnet restore
dotnet test Gms.sln                    # core invariants: ledger, consume, math, hashing
dotnet publish src/Api/Gms.Api -c Release -o publish/api
ASPNETCORE_URLS=http://127.0.0.1:5000 dotnet publish/api/Gms.Api.dll
```

`dotnet publish` output is self-contained if you add `-r linux-x64 --self-contained true`.

### 4.2 Operator UI (Next.js)

```bash
npm install
NEXT_PUBLIC_GMS_API_BASE=https://gms.example.com/api npm run build
npm start                              # serves on :3000
```

Without `NEXT_PUBLIC_GMS_API_BASE` the UI runs in **demo mode** (same contract, browser-local
persistence) — never use demo mode in production.

### 4.3 Reverse proxy (Caddy sample — a `Caddyfile` ships in the repo root)

```
gms.example.com {
    encode gzip
    handle /api/*   reverse_proxy 127.0.0.1:5000
    handle          reverse_proxy 127.0.0.1:3000
}
```

nginx equivalent: `location /api/ { proxy_pass http://127.0.0.1:5000; }` plus `/` → :3000.

### 4.4 systemd unit (Linux sample)

```ini
[Unit]
Description=GMS API
After=network.target

[Service]
WorkingDirectory=/opt/gms/publish/api
ExecStart=/usr/bin/dotnet /opt/gms/publish/api/Gms.Api.dll
Environment=ASPNETCORE_URLS=http://127.0.0.1:5000
Restart=always
User=gms

[Install]
WantedBy=multi-user.target
```

## 5. Post-deploy smoke checklist

1. `GET /api/v1/health` → `{"status":"ok"}`.
2. Login as admin → JWT issued; a wrong password 3× in a minute still succeeds on the 4th
   (rate limit is 10/min — hammering returns 429 + `rate_limit.exceeded`).
3. Swagger UI at `/swagger` lists all module groups including **Audit**.
4. Sell a package to a test member (cash) → receipt appears; refund it → status Refunded.
5. Top up a wallet → ledger row with exact `BalanceAfter`; sell with wallet → debit visible.
6. Check-in a member with a valid package → presence board shows them; check them out.
7. Place a buffet order (cash) → order + `BuffetPurchase` receipt.
8. As admin, `GET /api/v1/audit` → the mutating calls above are all recorded with redacted
   bodies (passwords never appear).

## 6. Audit log operations

- Every POST/PUT/PATCH/DELETE under `/api` lands in `gms-audit.db` with actor, role, branch,
  status, duration, IP and a redacted JSON body (password fields → `***`; non-JSON/oversized
  bodies are skipped). Read-only traffic is not audited.
- Read the trail via `GET /api/v1/audit?page=1&pageSize=20&action=POST&userId=<guid>` (admin).
- The audit DB grows with traffic — archive periodically (copy + `DELETE FROM AuditRecords
  WHERE OccurredAtUtc < date` inside a maintenance window) and keep table stats healthy.

## 7. Rollback / restore

- API is stateless — redeploy the previous publish output; databases stay untouched.
- Schema downgrades are not automatic (Initial migrations only). Restore database file
  backups taken per §3.3 if a rollback across schema changes is required.
- The audit DB is append-only; restoring it from an older backup loses only the newest trail
  rows, never application data.

## 8. Known v1 boundaries (by design)

- Single payment method per receipt (cash XOR wallet) — locked decision #5.
- No buffet inventory, no coach commissions — locked decisions #7/#8.
- Persian (fa, RTL) + English UI; data stored language-neutral; Jalali rendering in UI only.
- Money is integer Toman (`long`) end to end — never floats, never rounding at the edges.
