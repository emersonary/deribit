#!/usr/bin/env bash
set -euxo pipefail

# --- Paths & service ---
REPO_DIR="/opt/deribit"                 # monorepo root (where .git lives)
APP_DIR="$REPO_DIR/apps/node-app"       # app workspace folder
SERVICE="node-app"

# --- Logging ---
exec > >(tee -a "$APP_DIR/deploy.log") 2>&1
echo "=== DEPLOY $(date -u) on $(hostname) ($(hostname -I)) ==="
pwd || true
whoami || true

# --- Ensure permissions are sane for CI user (optional but handy) ---
if [ ! -w "$REPO_DIR/.git" ]; then
  sudo chown -R "$USER":"$USER" "$REPO_DIR"
fi
git config --global --add safe.directory "$REPO_DIR" || true

# --- Git ops happen at the monorepo root ---
cd "$REPO_DIR"
git remote -v
git rev-parse --abbrev-ref HEAD || true
git log -1 --oneline || true

git fetch origin
git reset --hard origin/main

# --- Install & build at the monorepo root ---
# Supports npm workspaces; falls back to plain npm if no workspaces.
if command -v corepack >/dev/null 2>&1; then corepack enable || true; fi

if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile
  # Build entire workspace graph or just the app and its deps:
  pnpm -F node-app... build
elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
  # Build whole workspace or target the app
  if yarn workspaces list >/dev/null 2>&1; then
    yarn workspaces foreach -At run build || true
    # or: yarn workspace node-app run build
  else
    (cd "$APP_DIR" && yarn build || true)
  fi
elif command -v npm >/dev/null 2>&1; then
  # npm workspaces support (npm v7+)
  if [ -f package-lock.json ]; then
    npm ci --workspaces --include-workspace-root || npm ci
  else
    npm install --workspaces --include-workspace-root || npm install
  fi

  # Prefer building only what's needed:
  # 1) Build deps first if you have a dedicated script in root: `npm run build:deps`
  # 2) Then build the app workspace specifically:
  if npm run | grep -qE '^\s*build\b'; then
    npm run build || true
  fi

  # Try targeted workspace build if available (npm v7+)
  npm run -w apps/node-app build || npm --workspace=node-app run build || true
else
  echo "WARN: No Node package manager found in PATH."
fi

# --- Restart service (still points at the app folder / systemd unit) ---
sudo -n systemctl stop "$SERVICE" || true
sleep 1
sudo -n systemctl start "$SERVICE"
sudo -n systemctl is-active "$SERVICE"
sudo -n systemctl status "$SERVICE" --no-pager -l | tail -n 50

echo "=== DONE $(date -u) ==="
