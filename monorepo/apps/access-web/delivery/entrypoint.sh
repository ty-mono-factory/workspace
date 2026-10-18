#!/usr/bin/env bash
set -Eeuo pipefail

# ---------- 可选：客户显式指定的 env 文件 ----------
if [[ -n "${ENV_FILE:-}" ]]; then
    if [[ ! -f "${ENV_FILE}" ]]; then
        echo "error: ENV_FILE=${ENV_FILE} does not exist" >&2
        exit 1
    fi
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
fi

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

  4) Use an env file:
       ENV_FILE=/etc/access-web/env ./entrypoint.sh

See ./database/README.md for migration instructions.
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

echo ">>> database: ${DATABASE_URL}"
echo ">>> starting access-web on ${NITRO_HOST}:${NITRO_PORT}"
exec node "${APP_ENTRY}"

docker run \
  --env-file /etc/access-web/env \
  -v access-web-data:/data \
  your-image:latest

docker run \
  -e DATABASE_URL="file:/data/access-web.db" \
  -v access-web-data:/data \
  your-image:latest

export DATABASE_URL="file:/var/lib/access-web/data.db"
./entrypoint.sh
