#!/usr/bin/env bash
# 本地开发环境变量。交付物不使用此文件。
#
# 用法：
#   source env.sh
#   pnpm --filter @monorepo/database db:migrate --name init
#
# 临时覆盖：
#   DATABASE_URL="file:/tmp/test.db" source env.sh   # 注意：这样不行
#   正确做法是先 export，再 source：
#   export DATABASE_URL="file:/tmp/test.db"
#   source env.sh                                     # 不会覆盖已设值

# DATABASE_URL：本地 SQLite 开发库
export DATABASE_URL="${DATABASE_URL:-file:///workspace/data/monorepo/database/dev.db}"

# 应用运行时（pnpm dev / pnpm build 用）
export PORT="${PORT:-3000}"
export HOST="${HOST:-0.0.0.0}"
