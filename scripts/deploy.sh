#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$PROJECT_DIR/deploy.log"

echo "=== Deploy started at $(date -Iseconds) ===" | tee -a "$LOG"

cd "$PROJECT_DIR"

echo "Pulling latest code..." | tee -a "$LOG"
git pull origin main 2>&1 | tee -a "$LOG"

echo "Installing dependencies..." | tee -a "$LOG"
pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG"

echo "Building..." | tee -a "$LOG"
pnpm build 2>&1 | tee -a "$LOG"

echo "Restarting server..." | tee -a "$LOG"
pm2 restart afkr-server 2>&1 | tee -a "$LOG"

echo "=== Deploy finished at $(date -Iseconds) ===" | tee -a "$LOG"
