#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(realpath "${script_dir}/../..")"
project_root="$(realpath "${script_dir}/../../../..")" # used by docker.conf
project_name="$(basename "${project_root}")"

usage() {
    echo "Usage: $0 --release-tag <app-release> [--materials-dir <offline-directory>]" >&2
}

release_tag=""
materials_override=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        --release-tag|--materials-dir)
            [[ $# -ge 2 && -n "$2" && "$2" != -* ]] || { usage; exit 2; }
            if [[ "$1" == --release-tag ]]; then release_tag="$2"; else materials_override="$2"; fi
            shift 2 ;;
        *) usage; exit 2 ;;
    esac
done
[[ "${release_tag}" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || { usage; exit 2; }

source "${script_dir}/../docker.conf"

docker_bin="$(command -v docker)"
packages_dir="${materials_override:-${material_dir}/runtime/deps/database}"
packages_dir="$(realpath -- "${packages_dir}")"
[[ -f "${packages_dir}/checksum.sha256" ]] || { echo "error: offline checksum manifest missing" >&2; exit 1; }

image_name="${image_registry}/${image_namespace}/${project_name}-dbmigrator:${release_tag}"
if "${docker_bin}" image inspect "${image_name}" >/dev/null 2>&1; then
    echo "error: release image already exists; use a new release tag" >&2
    exit 1
fi

# Load an offline base only if needed; never delete shared local images.
if ! "${docker_bin}" image inspect "${base_image}" >/dev/null 2>&1; then
    base_tar="${material_dir}/node-base/${base_image//:/-}.tar"
    [[ -f "${base_tar}" ]] || { echo "error: offline base image missing" >&2; exit 1; }
    "${docker_bin}" load -i "${base_tar}"
    "${docker_bin}" image inspect "${base_image}" >/dev/null
fi

context_dir="$(mktemp -d "${TMPDIR:-/tmp}/dbmigrator-build.XXXXXXXX")"
cleanup() { rm -rf -- "${context_dir}"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Isolated allowlisted context: no repository .env, data, node_modules or shared offline directory.
mkdir "${context_dir}/offline"
cp -R "${packages_dir}/." "${context_dir}/offline/"
cp "${script_dir}/Dockerfile" "${context_dir}/Dockerfile"
cp "${script_dir}/entrypoint.mjs" "${context_dir}/entrypoint.mjs"
output_dir="${context_dir}/migration"
source_dir="${repo_root}/packages/database/prisma"
[[ ! -e "${output_dir}" ]] || { echo "error: output directory already exists" >&2; exit 1; }
[[ -f "${source_dir}/schema.prisma" && -f "${source_dir}/migrations/migration_lock.toml" ]] || {
    echo "error: schema or migration lock is missing" >&2; exit 1;
}
find "${source_dir}/migrations" -mindepth 2 -maxdepth 2 -name migration.sql -print -quit | grep -q . || {
    echo "error: no migration.sql files found" >&2; exit 1;
}
mkdir -p "$(dirname -- "${output_dir}")"
mkdir -- "${output_dir}"
cp "${source_dir}/schema.prisma" "${output_dir}/schema.prisma"
cp -R "${source_dir}/migrations" "${output_dir}/migrations"
cp "${script_dir}/prisma.config.delivery.cjs" "${output_dir}/prisma.config.cjs"
(
    cd "${output_dir}"
    find schema.prisma prisma.config.cjs migrations -type f -print0 \
        | LC_ALL=C sort -z | xargs -0 sha256sum > checksum.sha256
)

prisma_version="$(sed -n 's/^[[:space:]]*prisma: "\([^"]*\)"[[:space:]]*$/\1/p' "${repo_root}/pnpm-workspace.yaml")"
[[ "${prisma_version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "error: expected one pinned Prisma version in pnpm-workspace.yaml" >&2; exit 1;
}

"${docker_bin}" build --pull=false --network=none --progress=plain \
    --build-arg "base_image=${base_image}" \
    --build-arg "prisma_version=${prisma_version}" \
    --build-arg "release_version=${release_tag}" \
    -t "${image_name}" "${context_dir}"
echo "Created release migrator: ${image_name}"
