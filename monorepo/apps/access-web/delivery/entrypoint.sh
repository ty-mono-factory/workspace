#!/bin/sh

set -eu

NODE_ENV="${NODE_ENV:-production}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-10001}"
NITRO_HOST="${NITRO_HOST:-$HOST}"
NITRO_PORT="${NITRO_PORT:-$PORT}"

export NODE_ENV HOST PORT NITRO_HOST NITRO_PORT

mkdir -p /workspace/data/monorepo/database

exec node /workspace/.output/server/index.mjs "$@"

