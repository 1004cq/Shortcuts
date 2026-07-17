#!/usr/bin/env bash
# MediaVault one-click deploy for a Linux server (Docker Compose)
# Usage (on the server as root):
#   curl -fsSL ... | bash   OR
#   bash scripts/deploy-server.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/mediavault}"
APP_PORT="${APP_PORT:-3000}"
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -fsSL -m 5 ifconfig.me || hostname -I | awk '{print $1}')}"
REPO_URL="${REPO_URL:-https://github.com/1004cq/Shortcuts.git}"
BRANCH="${BRANCH:-cursor/mediavault-scaffold-1d74}"

echo "==> MediaVault deploy"
echo "    APP_DIR=$APP_DIR"
echo "    PUBLIC_HOST=$PUBLIC_HOST"
echo "    BRANCH=$BRANCH"

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || true
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required." >&2
  exit 1
fi

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ -d .git ]; then
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  # Prefer existing checkout; otherwise clone
  if [ ! -f package.json ]; then
    git clone --branch "$BRANCH" "$REPO_URL" .
  fi
fi

SECRET="$(openssl rand -hex 32)"
cat > .env <<EOF
NEXTAUTH_URL=http://${PUBLIC_HOST}:${APP_PORT}
NEXTAUTH_SECRET=${SECRET}
APP_URL=http://${PUBLIC_HOST}:${APP_PORT}
MONGODB_URI=mongodb://mongo:27017/mediavault
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_BYTES=2147483648
EOF

# Production compose override: bind published URL into app container
cat > docker-compose.override.yml <<EOF
services:
  app:
    ports:
      - "${APP_PORT}:3000"
    env_file:
      - .env
    environment:
      NEXTAUTH_URL: http://${PUBLIC_HOST}:${APP_PORT}
      APP_URL: http://${PUBLIC_HOST}:${APP_PORT}
      NEXTAUTH_SECRET: ${SECRET}
      MONGODB_URI: mongodb://mongo:27017/mediavault
      UPLOAD_DIR: /app/uploads
EOF

echo "==> Building & starting containers..."
docker compose up -d --build

echo "==> Waiting for app..."
for i in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Seeding default users (admin / vip / free)..."
docker compose exec -T app npx tsx scripts/seed.ts || \
  docker compose run --rm -e MONGODB_URI=mongodb://mongo:27017/mediavault app npx tsx scripts/seed.ts || \
  echo "Seed skipped — run manually: docker compose exec app npx tsx scripts/seed.ts"

# Open firewall if firewalld/ufw present
if command -v ufw >/dev/null 2>&1; then
  ufw allow "${APP_PORT}/tcp" || true
fi
if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${APP_PORT}/tcp" || true
  firewall-cmd --reload || true
fi

echo ""
echo "✅ MediaVault is up"
echo "   URL:  http://${PUBLIC_HOST}:${APP_PORT}"
echo "   Admin: admin@mediavault.local / Admin123!"
echo "   Logs: docker compose -f ${APP_DIR}/docker-compose.yml logs -f app"
