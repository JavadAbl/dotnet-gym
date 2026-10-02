# GMS — Gym Management System

Multi-branch gym management: exercise packages (sessions + duration + branch access), coach packages, buffet factors, member wallets, and role-based operators (Admin / Reception / Buffet / Coach).

| Layer | Stack | Location |
|---|---|---|
| Frontend | Next.js 16 (App Router, TS, Tailwind 4, shadcn/ui, fa RTL + en) | `/` (this root) |
| Backend | ASP.NET Core modular monolith, EF Core + SQLite (WAL), JWT | `/backend` |
| Docs | Plan / progress / agent guide | `/download/gms-*.md` |

> Architecture source of truth: `download/gms-implementation-plan.md` — read it before changing anything.

## Quick start

### Backend (ASP.NET Core API, port 5000)

```bash
# requires .NET 10 SDK (workspace copy lives at /home/z/my-project/.dotnet)
cd backend/src/Gms.Api
dotnet run -c Release            # serves http://127.0.0.1:5000
```

- Database: SQLite at `backend/src/Gms.Api/gms.db` — migrations apply and demo data seeds automatically on startup.
- Swagger UI (Development): http://localhost:5000/swagger
- Health check: http://localhost:5000/health

**Seed users (development only):**

| User | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | Admin |
| `reception1` | `Reception@123` | Reception |
| `buffet1` | `Buffet@123` | Buffet |
| `coach1` | `Coach@123` | Coach |

### Frontend (Next.js, port 3000)

```bash
bun install
bun run dev        # http://localhost:3000
```

- The Next.js app is a **pure API consumer**; it calls the backend through BFF route handlers (`src/app/api/auth/*`) that store JWTs in httpOnly cookies.
- Backend URL is configured via `API_BASE_URL` in `.env.local` (default `http://127.0.0.1:5000`).
- Persian (`fa`) is the default locale (RTL, Vazirmatn font, cookie `NEXT_LOCALE`); switch to English from the UI.

### Tests

```bash
cd backend
dotnet test Gms.slnx        # unit + integration (SQLite via WebApplicationFactory)
```

## Repository layout

```
/home/z/my-project/
├─ backend/
│  ├─ src/Gms.Api/                  # host: Program.cs, auth, ProblemDetails, Swagger, DB init
│  ├─ src/Gms.BuildingBlocks/       # Result, BaseEntity, events, pagination, Money, WAL helper
│  ├─ src/Modules/
│  │  ├─ Identity/                  # users, roles, JWT auth (implemented — Phase 0)
│  │  ├─ Branches/                  # branch entity + list endpoint (implemented — Phase 0)
│  │  └─ Members|Catalog|Sales|Attendance|Coaching|Buffet|Wallet/   # skeletons (+ .Public contracts)
│  └─ tests/                        # Gms.UnitTests, Gms.IntegrationTests
├─ src/                             # Next.js app (frontend root)
│  ├─ app/page.tsx                  # login (the / route)
│  ├─ app/dashboard/                # role-based dashboard stub
│  ├─ app/api/auth/*                # BFF: login / refresh / logout / me (httpOnly cookies)
│  ├─ i18n/                         # next-intl config (cookie locale, fa default RTL)
│  └─ messages/{fa,en}.json
├─ download/                        # project docs: plan, progress tracker, agent guide
└─ AGENTS.md                        # start-here pointer for agents
```

## Engineering rules (enforced, see plan)

- Modular monolith: cross-module calls only via `*.Public` contracts; no cross-module FKs/JOINs.
- **No AutoMapper** — manual mapping extensions (`ToDto()`).
- Money = `long` Toman; dates = UTC ISO-8601; API errors = ProblemDetails + `errorCode` (culture-neutral).
- One payment method per factor (Cash | Wallet); prices resolved and snapshotted server-side.

## Status

Phase 0 (scaffolding) complete — see `download/gms-progress.md` for the live progress tracker and next steps.
