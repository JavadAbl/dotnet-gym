# GMS — Gym Management System

Modular-monolith gym management: ASP.NET Core 8 API (`backend/`) + Next.js 16 RTL admin app (this repo root, sandbox-runnable).

- Architecture & locked decisions: `download/gms-implementation-plan.md` (v1.1)
- Roadmap & current state: `download/gms-progress.md`
- Agent protocol: `download/gms-agents-guide.md`
- Work history: `worklog.md`

**Backend (run locally, .NET 8 SDK):**
```bash
cd backend && dotnet restore && dotnet run --project src/Api/Gms.Api
# Swagger: http://localhost:5000/swagger  ·  seeded login: admin / Admin@123
```

**Frontend (sandbox auto-runs on :3000):** RTL fa/en admin UI. Set `NEXT_PUBLIC_GMS_API_BASE=http://localhost:5000/api/v1` to bind to the real API; unset = built-in demo adapter (same contract, local persistence).
