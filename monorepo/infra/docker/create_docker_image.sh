#!/bin/bash

cleanup() {
  echo "Cleaning up..."
  rm -rf offline
  exit 1
}

set -euo pipefail

trap cleanup INT TERM

SCRIPTNAME=$(readlink -f "$0")
SCRIPTDIR=$(dirname "${SCRIPTNAME}")
PROJECTDIR=$(realpath "${SCRIPTDIR}/../../")
PROJECTNAME=$(basename "${PROJECTDIR}")

if ! command -v docker &>/dev/null; then
    echo "docker has not been installed!"
    exit 1
fi
DOCKER_BIN=$(command -v docker)

if [ -f "${SCRIPTDIR}/docker.conf" ]; then
    source "${SCRIPTDIR}/docker.conf"
else
    echo "${SCRIPTDIR}/docker.conf does NOT exist!"
    exit 1
fi

usage="$0 -- create docker image for monorepo (default: builder).
    $0 [option]
    [-h|--help:            Show this document.]
    [-f|--force:           Force remove the exists image instead of tagging it as backup.]
    [-p|--production:      Create a production docker image. (default: builder)]
"
IMAGETYPE="${BUILDER_IMAGE}"
VERSION="${BUILDER_VERSION}"
IS_FORCFULLY="no"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) echo "$usage" >&2; exit 0;;
        -f|--force) IS_FORCFULLY="yes"; shift;;
        -p|--production)
            IMAGETYPE="${PRODUCTION_IMAGE}"
            VERSION="${PRODUCTION_VERSION}"
            shift;;
        *) echo "Unsupported option $1" >&2; echo "$usage" >&2; exit 1;
    esac
done

DOCKERFILE_NAME="${DOCKER_FILE}.${IMAGETYPE}"
DOCKER_IMAGE_NAME="${PROJECTNAME}-${IMAGETYPE}"
DOCKER_IMAGE_FULLNAME="${DOCKER_IMAGE_NAME}:${VERSION}"

if [ ! -f "${SCRIPTDIR}/${DOCKERFILE_NAME}" ]; then
    echo "ERROR: Dockerfile ${SCRIPTDIR}/${DOCKERFILE_NAME} not found!" >&2
    exit 1
fi

git config --global --add safe.directory /home/chenty/myProjects/monorepo
GIT_TAG=$(git tag --list --sort=-version:refname | sed -n '1p')
WAREHOUSEDIR="${WAREHOUSE_ROOT}/${PROJECTNAME}"
OFFLINESTORE="${WAREHOUSEDIR}/${IMAGETYPE}/${GIT_TAG}"
if [ ! -d "${OFFLINESTORE}" ]; then
    echo "ERROR: offline store ${OFFLINESTORE} not found!" >&2
    exit 1
else
    mkdir -p "${SCRIPTDIR}/offline"
    cp "${OFFLINESTORE}"/*.* "${SCRIPTDIR}/offline/"
fi

NEED_CLEANUP_BASE="no"
BASE_IMAGE_IDENTITY="${BASE_IMAGE}"
if ! "${DOCKER_BIN}" image inspect "${BASE_IMAGE_IDENTITY}" &>/dev/null; then
    BASE_IMAGE_TAR="${WAREHOUSEDIR}/base/${BASE_IMAGE_IDENTITY}.tar"
    if [[ -f "${BASE_IMAGE_TAR}" ]]; then
        "${DOCKER_BIN}" load -i "${BASE_IMAGE_TAR}"
    else
        echo "No ${BASE_IMAGE_IDENTITY} found!"
        exit 1
    fi

    if ! "${DOCKER_BIN}" image inspect "${BASE_IMAGE_IDENTITY}" &>/dev/null; then
        echo "Failed to load ${BASE_IMAGE_IDENTITY}!"
        exit 1
    fi

    NEED_CLEANUP_BASE="yes"
fi

if "${DOCKER_BIN}" image inspect "${DOCKER_IMAGE_FULLNAME}" &>/dev/null; then
    echo "image ${DOCKER_IMAGE_FULLNAME} already exists."
    if [ "${IS_FORCFULLY}" = "yes" ]; then
        "${DOCKER_BIN}" rmi "${DOCKER_IMAGE_FULLNAME}"
    else
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        RANDOM_SUFFIX=$(date +%s%N | md5sum | cut -c1-8)
        "${DOCKER_BIN}" tag "${DOCKER_IMAGE_FULLNAME}" "${DOCKER_IMAGE_FULLNAME}_${TIMESTAMP}_${RANDOM_SUFFIX}"
    fi
fi

BUILD_ARGS=(
    --build-arg "BASE_IMAGE=${BASE_IMAGE_IDENTITY}"
    --build-arg "APP_UID=$(id -u)"
    --build-arg "APP_GID=$(id -g)"
    --no-cache
    # --progress=plain
)

"${DOCKER_BIN}" build "${BUILD_ARGS[@]}" -f "${SCRIPTDIR}/${DOCKERFILE_NAME}" -t "${DOCKER_IMAGE_FULLNAME}" "${PROJECTDIR}"

if [ "${NEED_CLEANUP_BASE}" = "yes" ]; then
    echo "Remove the temperary image ${BASE_IMAGE_IDENTITY} ..."
    "${DOCKER_BIN}" rmi --force "${BASE_IMAGE_IDENTITY}"
    echo "Remove sucessfully!"
fi
