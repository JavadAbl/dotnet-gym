# GMS Agent Guide

Working protocol for any agent continuing this project.

## 7-step workflow per phase
1. Read `download/gms-implementation-plan.md` (authority) + `download/gms-progress.md` (state) + `worklog.md` (history).
2. Announce the phase scope as a TODO list.
3. Implement backend first (module Domain → Infrastructure → Features → Public contract → DI wiring), following the modular-monolith hard rules.
4. Implement/extend the Next.js UI for the same scope (RTL fa-first, shadcn/ui, demo adapter kept in sync with the API contract).
5. Self-verify: `bun run lint` for the frontend; re-read backend files for compile-consistency (namespaces, csproj refs, sln entries) since no .NET SDK exists in-sandbox.
6. Update `download/gms-progress.md` (progress bar + phase checklist) — mandatory.
7. Append `worklog.md` (template below) — mandatory, append-only.

## 15 engineering rules
1. Cross-module access ONLY via `.Public` contracts; no FKs/JOINs across modules — store ids.
2. One DbContext + one SQLite file per module; WAL enabled at startup.
3. No AutoMapper — hand-written `ToDto()` extensions.
4. Money = integer Toman (`long`). Never float/double.
5. UTC everywhere in storage; Jalali only at display.
6. All routes `/api/v1/...`; ProblemDetails + machine-readable `errorCode` on every error.
7. Single payment method per receipt (cash XOR wallet).
8. Package = global definition + global price; per-branch via `PackageBranchAccess`; buffet prices are the only per-branch prices.
9. Session consumption must be atomic (conditional UPDATE, checked rows).
10. Freeze/unfreeze shifts `expiresAt` by frozen days; refund sets status Refunded and never re-activates sessions.
11. Roles: admin | reception | buffet | coach; JWT carries role + branchId claims.
12. Next.js app: single visible route `/` (sandbox constraint) — views switch client-side; RTL-first fa + en toggle.
13. Sandbox has no .NET SDK — backend ships as source; verify consistency by careful re-reading, not compilation.
14. UI must stay mobile-responsive; min 44px touch targets; footer sticks to bottom.
15. Never regress locked decisions v1.1 (bilingual fa/en, Toman, no PWA, no inventory, no commissions).

## worklog append template
```markdown
---
Task ID: <phase or sub-task id>
Agent: <name>
Task: <one line>

Work Log:
- <step>
Stage Summary:
- <results/decisions/artifacts>
```

## Definition of Done (per phase)
- Backend endpoints follow conventions & module rules; DTOs via manual mapping.
- UI flows demonstrable in sandbox preview (demo adapter) and against the real API by env switch.
- Progress bar + worklog updated; no locked decision violated.
