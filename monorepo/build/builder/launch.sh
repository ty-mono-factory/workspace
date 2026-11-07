#!/bin/bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_root=$(realpath "${script_dir}/../../../..")
project_name=$(basename "${project_root}")
workspace_dir=$(realpath "${script_dir}/../../..")
repo_root=$(realpath "${script_dir}/../..")
env_file="${repo_root}/.env"


usage="
    [-h|--help:             Show this document.]
    [--env-file <path>:     Docker-format environment file (default: monorepo/.env).]
    [-c|--for-ci-builder:   For CI/CD build.]
    [-- <command>:          Command to run inside the container (default: /bin/bash).]
"

command_args=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) echo "$usage" >&2; exit 0;;
        --env-file)
            if [[ $# -lt 2 || -z "$2" || "$2" == -* ]]; then
                echo "error: --env-file requires a path" >&2
                exit 1
            fi
            env_file="$2"
            shift 2
            ;;
        -c|--for-ci-builder)
            export CI=true
            shift;;
        --)
            shift
            command_args=("$@")
            break;;
        *) echo "Unsupported option $1" >&2; echo "$usage" >&2; exit 1;;
    esac
done

if ! docker_bin="$(command -v docker)"; then
    echo "docker has not been installed!" >&2
    exit 1
fi

if [ -f "${script_dir}/../docker.conf" ]; then
    source "${script_dir}/../docker.conf"
else
    echo "${script_dir}/../docker.conf does NOT exist!" >&2
    exit 1
fi


if [ ${#command_args[@]} -eq 0 ]; then
    command_args=(/bin/bash)
fi

if [[ ! -f "${env_file}" || ! -r "${env_file}" ]]; then
    echo "error: environment file is not readable: ${env_file}" >&2
    exit 1
fi
env_file=$(realpath "${env_file}")

image_name="${image_registry}/${image_namespace}/${project_name}-builder:${builder_version}"
container_name="${project_name}-builder-${USER}-$$"

if ! "${docker_bin}" image inspect "${image_name}" &>/dev/null; then
    echo "image ${image_name} does NOT exist." >&2
    ## Download the image from a server in the future.
    # image_name_with_server="image-server.com/${image_name}"
    # "${docker_bin}" pull "${image_name_with_server}" > /dev/null
    exit 1
fi

run_opts=(
    --rm
    --init
)

if [ -t 0 ]; then
    run_opts+=(-it)
fi

"${docker_bin}" run "${run_opts[@]}" \
  --env-file "${env_file}" \
  -v "${workspace_dir}:/workspace" \
  -w /workspace/monorepo \
  -u "$(id -u):$(id -g)" \
  -p 10001-10020:10001-10020 \
  -p 5555:5555 \
  -e HOME=/workspace \
  -e CCACHE_DIR=/workspace/.cache/ccache \
  -e CMAKE_BUILD_PARALLEL_LEVEL="$(nproc)" \
  -e CMAKE_CACHE_DIR=/workspace/.cache/cmake \
  -e CONAN_USER_HOME=/workspace/.cache/conan \
  -e VCPKG_DEFAULT_BINARY_CACHE=/workspace/.cache/vcpkg \
  -e XDG_CACHE_HOME=/workspace/.cache \
  -e npm_config_cache=/workspace/.cache/npm \
  -e YARN_CACHE_FOLDER=/workspace/.cache/yarn \
  -e CARGO_HOME=/workspace/.cache/cargo \
  -e GOPATH=/workspace/.cache/go \
  -e PNPM_HOME=/workspace/pnpm-store \
  -e PNPM_STORE_DIR=/workspace/pnpm-store/store \
  -e COREPACK_HOME=/workspace/corepack-cache \
  --name="${container_name}" \
  "${image_name}" \
  "${command_args[@]}"

