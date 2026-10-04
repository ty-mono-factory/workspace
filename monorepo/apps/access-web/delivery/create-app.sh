#!/usr/bin/env bash

set -Eeuo pipefail

readonly SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly PROJECT_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"

# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

# Stage 01 deliberately has one fixed delivery target. These constants are the
# seam for introducing an app-name parameter after a second app is delivered.
readonly APP_NAME=ty-demo-app
readonly APP_PACKAGE=@monorepo/ty-demo-app
readonly APP_DIR="${PROJECT_DIR}/apps/${APP_NAME}"
readonly APP_OUTPUT_DIR="${APP_DIR}/.output"
readonly NATIVE_PACKAGE_DIR="${PROJECT_DIR}/packages/ty-demo"
readonly NATIVE_BINARY="${NATIVE_PACKAGE_DIR}/build/Release/ty_demo.node"
readonly RELEASE_DIR="${PROJECT_DIR}/release"
readonly RELEASE_ARCHIVE="${RELEASE_DIR}/${APP_NAME}.tar.gz"
readonly SMOKE_PORT=31002
readonly SMOKE_PATH=/api/ty-demo
readonly SMOKE_EXPECTED='My name is chenty-apps'

usage() {
    cat <<EOF
Usage: ${SCRIPT_NAME} --release
       ${SCRIPT_NAME} -r

Create the fixed Stage 01 application artifact:
  release/${APP_NAME}.tar.gz
EOF
}

release_requested=no
while [[ $# -gt 0 ]]; do
    case "$1" in
        -r|--release)
            if [[ "${release_requested}" == yes ]]; then
                echo "ERROR: --release was specified more than once." >&2
                exit 2
            fi
            release_requested=yes
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "ERROR: unsupported option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if [[ "${release_requested}" != yes ]]; then
    echo "ERROR: this Stage 01 script requires --release or -r." >&2
    usage >&2
    exit 2
fi

if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
    echo "ERROR: release artifacts must be built in the linux/amd64 builder." >&2
    exit 1
fi

delivery_require_commands node pnpm tar gzip sha256sum find readlink

mkdir -p "${RELEASE_DIR}"
STAGING_DIR="$(mktemp -d "${RELEASE_DIR}/.${APP_NAME}.XXXXXX")"
TEMP_ARCHIVE="$(mktemp "${RELEASE_DIR}/.${APP_NAME}.tar.gz.XXXXXX")"
SERVER_PID=""

cleanup() {
    if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
        kill "${SERVER_PID}" >/dev/null 2>&1 || true
        wait "${SERVER_PID}" 2>/dev/null || true
    fi

    rm -rf -- "${STAGING_DIR}"
    rm -f -- "${TEMP_ARCHIVE}"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "${PROJECT_DIR}"

echo ">>> Cleaning previous build output for ${APP_NAME}"
pnpm clean
rm -rf -- "${APP_OUTPUT_DIR}"

echo ">>> Installing the locked workspace dependencies"
pnpm install --frozen-lockfile

# The current app still has a build-time dependency chain through
# access-server -> database. This generates client code and does not mutate a
# database; db:push is intentionally not part of delivery.
echo ">>> Generating Prisma Client required by the current dependency graph"
pnpm --filter @monorepo/database db:generate

echo ">>> Building ${APP_NAME} and its workspace dependencies"
TY_DEMO_ACCESS_MODE=public \
    pnpm exec turbo run build --filter="${APP_PACKAGE}..."

if [[ ! -f "${APP_OUTPUT_DIR}/server/index.mjs" ]]; then
    echo "ERROR: Nuxt server output was not generated." >&2
    exit 1
fi

if [[ ! -f "${NATIVE_BINARY}" ]]; then
    echo "ERROR: native addon was not generated: ${NATIVE_BINARY}" >&2
    exit 1
fi

echo ">>> Assembling the standalone ${APP_NAME} release"
mkdir -p "${STAGING_DIR}/.output" "${STAGING_DIR}/native"
cp -a "${APP_OUTPUT_DIR}/." "${STAGING_DIR}/.output/"
cp "${NATIVE_BINARY}" "${STAGING_DIR}/native/ty_demo.node"

# If Nitro keeps the workspace import external, provide the minimal runtime
# package. If Nitro inlines it, TY_DEMO_NATIVE_PATH still locates the addon.
readonly OUTPUT_MONOREPO_DIR="${STAGING_DIR}/.output/server/node_modules/@monorepo"
if [[ -L "${OUTPUT_MONOREPO_DIR}" ]]; then
    echo "ERROR: release dependency directory is an external symbolic link: ${OUTPUT_MONOREPO_DIR}" >&2
    exit 1
fi

readonly OUTPUT_NATIVE_PACKAGE="${STAGING_DIR}/.output/server/node_modules/@monorepo/ty-demo"
if [[ -L "${OUTPUT_NATIVE_PACKAGE}" ]]; then
    rm -- "${OUTPUT_NATIVE_PACKAGE}"
fi
mkdir -p \
    "${OUTPUT_NATIVE_PACKAGE}/dist" \
    "${OUTPUT_NATIVE_PACKAGE}/build/Release"
cp "${NATIVE_PACKAGE_DIR}/package.json" "${OUTPUT_NATIVE_PACKAGE}/package.json"
cp -a "${NATIVE_PACKAGE_DIR}/dist/." "${OUTPUT_NATIVE_PACKAGE}/dist/"
cp "${NATIVE_BINARY}" "${OUTPUT_NATIVE_PACKAGE}/build/Release/ty_demo.node"

# A release archive must not contain links back to the builder workspace.
while IFS= read -r -d '' link_path; do
    resolved_path="$(readlink -f "${link_path}")"
    case "${resolved_path}" in
        "${STAGING_DIR}"/*) ;;
        *)
            echo "ERROR: release contains an external symbolic link: ${link_path} -> ${resolved_path}" >&2
            exit 1
            ;;
    esac
done < <(find "${STAGING_DIR}" -type l -print0)

echo ">>> Running the clean release smoke test"
SMOKE_LOG="${STAGING_DIR}/smoke.log"
(
    cd "${STAGING_DIR}"
    NODE_ENV=production \
    HOST=127.0.0.1 \
    PORT="${SMOKE_PORT}" \
    NUXT_ACCESS_MODE=public \
    TY_DEMO_NATIVE_PATH="${STAGING_DIR}/native/ty_demo.node" \
        node .output/server/index.mjs
) >"${SMOKE_LOG}" 2>&1 &
SERVER_PID=$!

if ! node --input-type=module -e \
    "let lastError; for (let attempt = 0; attempt < 50; attempt += 1) { try { const response = await fetch('http://127.0.0.1:${SMOKE_PORT}${SMOKE_PATH}'); if (!response.ok) throw new Error('HTTP ' + response.status); const body = await response.json(); if (body !== '${SMOKE_EXPECTED}') throw new Error('unexpected response: ' + JSON.stringify(body)); process.exit(0); } catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 200)); } } throw lastError"; then
    cat "${SMOKE_LOG}" >&2
    exit 1
fi

kill "${SERVER_PID}"
wait "${SERVER_PID}" 2>/dev/null || true
SERVER_PID=""
rm -f -- "${SMOKE_LOG}"

echo ">>> Creating ${RELEASE_ARCHIVE}"
tar \
    --sort=name \
    --mtime='UTC 1970-01-01' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    -C "${STAGING_DIR}" \
    -czf "${TEMP_ARCHIVE}" \
    .

tar -tzf "${TEMP_ARCHIVE}" >/dev/null
mv -f -- "${TEMP_ARCHIVE}" "${RELEASE_ARCHIVE}"

echo ">>> Release created: ${RELEASE_ARCHIVE}"
sha256sum "${RELEASE_ARCHIVE}"

