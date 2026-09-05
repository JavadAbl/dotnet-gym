# GMS Backend — ASP.NET Core 8 Modular Monolith

## Run (requires .NET 8 SDK — not available in the sandbox, run locally)

```bash
dotnet restore
dotnet run --project src/Api/Gms.Api
# Swagger UI: http://localhost:5000/swagger
```

First start creates `data/*.db` (one SQLite file per module, WAL enabled) and seeds:

| Seed | Detail |
|---|---|
| Users | `admin / Admin@123` · `reception.north`, `reception.south`, `buffet.north`, `coach.north` / `Operator@123` |
| Branches | North Branch (شعبه شمال) · South Branch (شعبه جنوب) |
| Packages | VIP 12 sessions / 30 days / 2,500,000 T (both branches) · Basic 8 / 14 / 1,200,000 T (South only) |
| Buffet | Water 15,000 T · Protein Bar 85,000 T N / 95,000 T S · Energy Drink 60,000 T |
| Demo members | M-00001 … M-00004 (علی محمدی، سارا کریمی، رضا حسینی، مریم احمدی) |

## API surface (Phase 2 state)

```
POST /api/v1/identity/login                (anon)        → JWT (sub, role, branchId)
GET  /api/v1/identity/me                   (staff)
GET  /api/v1/branches                      (staff)
POST /api/v1/branches                      (admin)
PUT  /api/v1/branches/{id}                 (admin)
GET  /api/v1/catalog/packages              (staff)
GET  /api/v1/catalog/packages/{id}         (staff)
POST /api/v1/catalog/packages              (admin)
GET  /api/v1/catalog/products?branchId=    (staff)
GET  /api/v1/members?search&status&branchId&page&pageSize   (staff)
POST /api/v1/members                       (admin|reception)
GET  /api/v1/members/{id}                  (staff)
PUT  /api/v1/members/{id}                  (admin|reception)
POST /api/v1/members/{id}/status           (admin|reception)
GET  /api/v1/health                        (anon)
```

Errors: RFC7807 `application/problem+json` with `errorCode` (e.g. `member.phone.duplicate`) and optional `errors` field map.

## Module rules (enforced by convention)

- One EF Core `DbContext` + one SQLite file per module; cross-module data ONLY via `*.Public` contracts.
- No cross-module FKs/JOINs; ids are stored and resolved through contract calls.
- No AutoMapper — hand-written `ToDto()` extensions.
- Money = `long` Toman; timestamps UTC.
- Auth claims: `sub` (userId), `role` (admin|reception|buffet|coach), `branchId` (when applicable).
