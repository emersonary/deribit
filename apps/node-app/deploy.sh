#!/usr/bin/env bash
set -euxo pipefail

APP_DIR="/opt/deribit/apps/node-app"
SERVICE="node-app"

# log everything
exec > >(tee -a "$APP_DIR/deploy.log") 2>&1
echo "=== DEPLOY $(date -u) on $(hostname) ($(hostname -I)) ==="
pwd || true
whoami || true

cd "$APP_DIR"

# Show repo state
git remote -v
git rev-parse --abbrev-ref HEAD || true
git log -1 --oneline || true

# Fetch newest main and hard reset
git fetch origin
git reset --hard origin/main

# Node deps/build if npm exists
if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  if npm run | grep -qE '^\s*build\b'; then
    npm run build
  fi
else
  echo "WARN: npm not found in PATH"
fi

# Restart service (no-password sudo expected)
sudo -n systemctl restart "$SERVICE"
sudo -n systemctl is-active "$SERVICE"
sudo -n systemctl status "$SERVICE" --no-pager -l | tail -n 50

echo "=== DONE $(date -u) ==="