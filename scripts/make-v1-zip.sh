#!/usr/bin/env bash
# Stage gms-v1/ release snapshot: frontend + backend + docs for future agents
set -euo pipefail

ROOT=/home/z/my-project
STAGE="$ROOT/staging-gms-v1/gms-v1"

rm -rf "$ROOT/staging-gms-v1"
mkdir -p "$STAGE/docs/screenshots" "$STAGE/frontend"

# ---------- backend: full source tree (solution, 9 modules + .Public, Api host, tests, dotnet-tools) ----------
cp -r "$ROOT/backend" "$STAGE/backend"

# ---------- frontend: Next.js app (source + configs only; no node_modules/.next/build junk) ----------
cp -r "$ROOT/src"            "$STAGE/frontend/src"
cp -r "$ROOT/public"         "$STAGE/frontend/public"
cp -r "$ROOT/prisma"         "$STAGE/frontend/prisma"
cp "$ROOT/package.json"      "$STAGE/frontend/package.json"
cp "$ROOT/bun.lock"          "$STAGE/frontend/bun.lock"
cp "$ROOT/next.config.ts"    "$STAGE/frontend/next.config.ts"
cp "$ROOT/next-env.d.ts"     "$STAGE/frontend/next-env.d.ts"
cp "$ROOT/tsconfig.json"     "$STAGE/frontend/tsconfig.json"
cp "$ROOT/tailwind.config.ts" "$STAGE/frontend/tailwind.config.ts"
cp "$ROOT/postcss.config.mjs" "$STAGE/frontend/postcss.config.mjs"
cp "$ROOT/eslint.config.mjs" "$STAGE/frontend/eslint.config.mjs"
cp "$ROOT/components.json"   "$STAGE/frontend/components.json"
cp "$ROOT/.gitignore"        "$STAGE/frontend/.gitignore"

# .env: portable version (relative sqlite path) + documented example
cat > "$STAGE/frontend/.env" <<'EOF'
DATABASE_URL=file:./db/custom.db
EOF
cat > "$STAGE/frontend/.env.example" <<'EOF'
# Bind the UI to the real ASP.NET Core API (leave unset for the built-in demo adapter,
# which implements the exact same contracts with local persistence + demo seeds).
# NEXT_PUBLIC_GMS_API_BASE=http://localhost:5000/api/v1

# Prisma (scaffold leftover, unused by GMS views; kept so prisma CLI commands work)
DATABASE_URL=file:./db/custom.db
EOF

# ---------- docs: authoritative project docs + verification screenshots ----------
cp "$ROOT/download/gms-implementation-plan.md" "$STAGE/docs/"
cp "$ROOT/download/gms-progress.md"            "$STAGE/docs/"
cp "$ROOT/download/gms-agents-guide.md"        "$STAGE/docs/"
cp "$ROOT/download/gms-deployment.md"          "$STAGE/docs/"
cp "$ROOT"/download/gms-phase*.png             "$STAGE/docs/screenshots/"

# ---------- root-level agent continuity files ----------
cp "$ROOT/AGENTS.md"   "$STAGE/AGENTS.md"
cp "$ROOT/worklog.md"  "$STAGE/worklog.md"

echo "Staged at $STAGE"
du -sh "$STAGE" "$STAGE"/backend "$STAGE"/frontend "$STAGE"/docs
