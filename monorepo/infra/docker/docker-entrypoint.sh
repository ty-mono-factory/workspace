#!/usr/bin/env bash
set -euo pipefail

: "${HOME:=/workspace}"

# 只保证目录可写，不碰 /etc/passwd，不切换用户
mkdir -p "${HOME}"
mkdir -p /workspace/.cache /workspace/pnpm-store /workspace/corepack-cache

exec "$@"
