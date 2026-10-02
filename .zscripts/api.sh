#!/bin/bash
# Keeps the GMS ASP.NET Core API alive in the sandbox (mirrors dev.sh's start pattern).
set -uo pipefail

PROJECT_DIR="/home/z/my-project"
API_DIR="$PROJECT_DIR/backend/src/Gms.Api"
LOG_FILE="$PROJECT_DIR/scripts/api.log"

export PATH="/home/z/my-project/.dotnet:/home/z/my-project/.dotnet/tools:$PATH"
export DOTNET_ROOT="/home/z/my-project/.dotnet"
export DOTNET_NOLOGO=1
export DOTNET_CLI_TELEMETRY_OPTOUT=1

cd "$API_DIR"

nohup dotnet run --no-build -c Release --urls http://127.0.0.1:5000 >> "$LOG_FILE" 2>&1 &
API_PID=$!

for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:5000/health >/dev/null 2>&1; then
    echo "GMS API healthy (PID: $API_PID)"
    disown "$API_PID" 2>/dev/null || true
    exit 0
  fi
  sleep 1
done

echo "GMS API failed to become healthy"
exit 1
