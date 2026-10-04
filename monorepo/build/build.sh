#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)"

usage() {
    cat >&2 <<'EOF'
Usage:
  build.sh --project <app>       Clean the workspace, build the app and package it
  build.sh --clean [--project <app>]
                                 Clean all generated files, or only one app
EOF
}

PROJECT=""
CLEAN_ONLY="no"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--project)
            [[ $# -ge 2 ]] || { echo "error: --project needs a value" >&2; usage; exit 1; }
            PROJECT="$2"
            shift 2
            ;;
        --clean)
            CLEAN_ONLY="yes"
            shift
            ;;
        -h|--help)
            usage >&2
            exit 0
            ;;
        *)
            echo "error: unsupported option: $1" >&2
            usage
            exit 1
            ;;
    esac
done

clean_workspace() {
    echo ">>> cleaning workspace generated files"

    find "$REPO_ROOT/apps" "$REPO_ROOT/packages" \
        -type d \( \
            -name .nuxt \
            -o -name .output \
            -o -name dist \
            -o -name build \
            -o -name .turbo \
        \) -prune -exec rm -rf {} +

    find "$REPO_ROOT/apps" "$REPO_ROOT/packages" \
        -type f \( \
            -name '*.tsbuildinfo' \
            -o -name '*.log' \
        \) -delete

    rm -rf "$REPO_ROOT/build/artifacts"
}

clean_project() {
    local project="$1"
    local app_dir="$REPO_ROOT/apps/$project"

    [[ -d "$app_dir" ]] || {
        echo "error: app directory does not exist: $app_dir" >&2
        exit 1
    }

    echo ">>> cleaning app: $project"
    rm -rf \
        "$app_dir/.nuxt" \
        "$app_dir/.output" \
        "$app_dir/dist" \
        "$app_dir/build" \
        "$app_dir/.turbo" \
        "$REPO_ROOT/build/artifacts/$project.tar.gz"
    find "$app_dir" -type f \( -name '*.tsbuildinfo' -o -name '*.log' \) -delete
}

if [[ "$CLEAN_ONLY" == "yes" ]]; then
    if [[ -n "$PROJECT" ]]; then
        clean_project "$PROJECT"
    else
        clean_workspace
    fi
    exit 0
fi

[[ -n "$PROJECT" ]] || {
    echo "error: --project is required when building" >&2
    usage
    exit 1
}

[[ "$PROJECT" != */* && "$PROJECT" != .* && "$PROJECT" != *..* ]] || {
    echo "error: invalid project name: $PROJECT" >&2
    exit 1
}

APP_DIR="$REPO_ROOT/apps/$PROJECT"
APP_SELECTOR="./apps/$PROJECT"
DELIVERY_DIR="$APP_DIR/delivery"
ARTIFACT_DIR="$REPO_ROOT/build/artifacts"
TARBALL="$ARTIFACT_DIR/$PROJECT.tar.gz"

[[ -f "$APP_DIR/package.json" ]] || {
    echo "error: app package.json does not exist: $APP_DIR/package.json" >&2
    exit 1
}
[[ -s "$DELIVERY_DIR/manifest" ]] || {
    echo "error: runtime manifest does not exist or is empty: $DELIVERY_DIR/manifest" >&2
    exit 1
}
[[ -s "$DELIVERY_DIR/entrypoint.sh" ]] || {
    echo "error: entrypoint does not exist or is empty: $DELIVERY_DIR/entrypoint.sh" >&2
    exit 1
}

clean_workspace
mkdir -p "$ARTIFACT_DIR"

command -v pnpm >/dev/null 2>&1 || {
    echo "error: pnpm is required; expected pnpm 10.34.4" >&2
    exit 1
}

cd "$REPO_ROOT"

echo ">>> installing workspace dependencies"
pnpm install --frozen-lockfile

# These values are only fallbacks for the build. Runtime secrets and URLs must
# still be supplied to the container through its environment.
export DATABASE_URL="${DATABASE_URL:-file:///workspace/data/monorepo/database/dev.db}"
export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:10001}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-docker-build-only-secret-change-at-runtime}"

if [[ -f "$REPO_ROOT/packages/database/prisma/schema.prisma" ]]; then
    echo ">>> generating Prisma Client"
    pnpm --filter ./packages/database db:generate
fi

echo ">>> building app: $PROJECT"
pnpm --filter "$APP_SELECTOR" build

test -f "$APP_DIR/.output/server/index.mjs" || {
    echo "error: build did not produce $APP_DIR/.output/server/index.mjs" >&2
    exit 1
}

PACKAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/monorepo-release.XXXXXX")"
STAGING_DIR="$PACKAGE_ROOT/runtime"
cleanup() {
    rm -rf "$PACKAGE_ROOT"
}
trap cleanup EXIT

echo ">>> packaging production deployment: $PROJECT"
pnpm --filter "$APP_SELECTOR" --prod --ignore-scripts deploy --legacy "$STAGING_DIR"

tar -czf "$TARBALL" -C "$STAGING_DIR" .

echo ">>> created $TARBALL"

