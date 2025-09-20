sudo tee /opt/deribit/apps/node-app/deploy.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="/opt/deribit/apps/node-app"
SERVICE="node-app"

cd "$APP_DIR"

# Get latest code for main
git fetch origin
git reset --hard origin/main

# Install Node deps; prefer clean install if lockfile exists
if command -v npm >/dev/null 2>&1; then
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  # Build if you have a build script
  if npm run | grep -qE '^\s*build'; then
    npm run build
  fi
fi

# Restart service
sudo systemctl restart "$SERVICE"

# Optional: quick health/status dump
sudo systemctl --no-pager --lines=20 status "$SERVICE"
EOF

sudo chmod +x /opt/deribit/apps/node-app/deploy.sh
