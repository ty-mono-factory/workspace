#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(realpath "${script_dir}/../..")"
project_root="$(realpath "${script_dir}/../../../..")"
project_name="$(basename "${project_root}")"
usage() {
    echo "Usage: $0 --project <app> --release-tag <version> [--materials-dir <offline-directory>]" >&2
}
project=""
release_tag=""
materials_override=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) usage; exit 0 ;;
        -p|--project|--release-tag|--materials-dir)
            [[ $# -ge 2 && -n "$2" && "$2" != -* ]] || { usage; exit 2; }
            case "$1" in
                -p|--project) project="$2" ;;
                --release-tag) release_tag="$2" ;;
                --materials-dir) materials_override="$2" ;;
            esac
            shift 2 ;;
        *) usage; exit 2 ;;
    esac
done
[[ "$project" =~ ^[A-Za-z0-9][A-Za-z0-9_-]*$ && "$release_tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || { usage; exit 2; }
source "${script_dir}/../docker.conf"
docker_bin="$(command -v docker)"
application_dir="${repo_root}/artifacts/${project}"
[[ -f "${application_dir}/entrypoint.sh" ]] || { echo "error: build the application archive first" >&2; exit 1; }
packages_dir="$(realpath "${materials_override:-${material_dir}/runtime/deps/${project}}")"
[[ -f "${packages_dir}/checksum.sha256" ]] || { echo "error: offline checksum manifest missing" >&2; exit 1; }
image_name="${image_registry}/${image_namespace}/${project_name}-${project}:${release_tag}"
if "${docker_bin}" image inspect "${image_name}" >/dev/null 2>&1; then
    echo "error: release image already exists; use a new tag" >&2
    exit 1
fi
if ! "${docker_bin}" image inspect "${base_image}" >/dev/null 2>&1; then
    base_tar="${material_dir}/node-base/${base_image//:/-}.tar"
    [[ -f "$base_tar" ]] || { echo "error: offline base image missing" >&2; exit 1; }
    "${docker_bin}" load -i "$base_tar"
fi
context_dir="$(mktemp -d "${TMPDIR:-/tmp}/app-release-build.XXXXXXXX")"
trap 'rm -rf -- "${context_dir}"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "${context_dir}/application" "${context_dir}/offline"
cp -R "${application_dir}/." "${context_dir}/application/"
cp -R "${packages_dir}/." "${context_dir}/offline/"
cp "${script_dir}/Dockerfile" "${context_dir}/Dockerfile"
"${docker_bin}" build --pull=false --network=none --progress=plain \
    --build-arg "base_image=${base_image}" --build-arg "release_version=${release_tag}" \
    -t "$image_name" "$context_dir"
echo "Created application release: ${image_name}"
