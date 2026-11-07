#!/usr/bin/env bash
set -Eeuo pipefail

# ---------- 必需配置校验 ----------
if [[ -z "${DATABASE_URL:-}" ]]; then
    cat >&2 <<'EOF'
error: DATABASE_URL is not set.

DATABASE_URL must point to persistent storage. Container-local paths
(./data, /tmp, /run, /dev/shm) will lose data when the container is
removed or the host reboots.

Choose one of:

  1) Docker with a named volume:
       docker run -v access-web-data:/data \
         -e DATABASE_URL="file:/data/access-web.db" ...

  2) Docker with a host bind mount:
       docker run -v /srv/access-web:/data \
         -e DATABASE_URL="file:/data/access-web.db" ...

  3) Bare metal:
       export DATABASE_URL="file:/var/lib/access-web/data.db"
       ./entrypoint.sh

Run the matching release dbmigrator image before starting the application.
EOF
    exit 1
fi

# ---------- 启动 ----------
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
export NITRO_PORT="${NITRO_PORT:-$PORT}"
export NITRO_HOST="${NITRO_HOST:-$HOST}"

APP_ENTRY="${APP_ENTRY:-./access-web/server/index.mjs}"
if [[ ! -f "${APP_ENTRY}" ]]; then
    echo "error: application entry not found: ${APP_ENTRY}" >&2
    exit 1
fi

echo ">>> starting access-web on ${NITRO_HOST}:${NITRO_PORT}"
exec node "${APP_ENTRY}"
