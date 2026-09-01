#!/bin/bash
# Path: monorepo/monorepo/build/docker/launch_builder.sh

set -euo pipefail

SCRIPTNAME=$(readlink -f "$0")
SCRIPTDIR=$(dirname "${SCRIPTNAME}")
PROJECTDIR=$(realpath "${SCRIPTDIR}/../../")
PROJECTNAME=$(basename "${PROJECTDIR}")
WORKSPACEDIR=$(realpath "${PROJECTDIR}/../")

if ! command -v docker &>/dev/null; then
    echo "docker has not been installed!" >&2
    exit 1
fi
DOCKER_BIN=$(command -v docker)

if [ -f "${SCRIPTDIR}/docker.conf" ]; then
    source "${SCRIPTDIR}/docker.conf"
else
    echo "${SCRIPTDIR}/docker.conf does NOT exist!" >&2
    exit 1
fi

usage="${SCRIPTNAME} -- monorepo builder launcher
    [-h|--help]
    [-c|--for-ci-builder]
    [-- <command>]
"
COMMAND_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) echo "$usage" >&2; exit 0;;
        -c|--for-ci-builder) export CI=true; shift;;
        --) shift; COMMAND_ARGS=("$@"); break;;
        *) echo "Unsupported option $1" >&2; echo "$usage" >&2; exit 1;;
    esac
done

if [ ${#COMMAND_ARGS[@]} -eq 0 ]; then
    COMMAND_ARGS=(/bin/bash)
fi

BUILDER_CONTAINER_VERSION="${BUILDER_VERSION:-latest}"
DOCKER_IMAGE_NAME="${PROJECTNAME}-${BUILDER_IMAGE}"
DOCKER_IMAGE_FULLNAME="${DOCKER_IMAGE_NAME}:${BUILDER_CONTAINER_VERSION}"
CONTAINER_NAME="${DOCKER_IMAGE_NAME}-${USER}-$$"

if ! "${DOCKER_BIN}" image inspect "${DOCKER_IMAGE_FULLNAME}" &>/dev/null; then
    echo "image ${DOCKER_IMAGE_FULLNAME} does NOT exist." >&2
    # 未来有可能从镜像服务器下载
    # DOCKER_FROM_SERVER="image-server.com/${DOCKER_IMAGE_FULLNAME}"
    # "${DOCKER_BIN}" pull "${DOCKER_FROM_SERVER}" > /dev/null
    exit 1
fi

DOCKER_RUN_OPTS=(--rm --init)
if [ -t 0 ]; then
    DOCKER_RUN_OPTS+=(-it)
fi

# Use docker/ as build context so Dockerfile can reference sibling files
"${DOCKER_BIN}" run "${DOCKER_RUN_OPTS[@]}" \
  -v "${WORKSPACEDIR}:/workspace" \
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
  --name="${CONTAINER_NAME}" \
  "${DOCKER_IMAGE_FULLNAME}" \
  "${COMMAND_ARGS[@]}"
