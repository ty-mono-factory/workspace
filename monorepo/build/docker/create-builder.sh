#!/bin/bash

set -euo pipefail

cleanup() {
    local exit_code=$?
    echo "Cleaning up... (exit_code=$exit_code)"
    if [[ -n "${script_dir:-}" ]]; then
        rm -rf "${script_dir}/offline"
    fi
    if [[ "${cleanup_base:-no}" == "yes" && -n "${base_image:-}" && -n "${docker_bin:-}" ]]; then
        "${docker_bin}" rmi --force "${base_image}" 2>/dev/null || true
    fi
    exit "$exit_code"
}
trap cleanup EXIT INT TERM

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_root=$(realpath "${script_dir}/../../../..")
project_name=$(basename "${project_root}")

if ! docker_bin="$(command -v docker)"; then
    echo "docker has not been installed!" >&2
    exit 1
fi

if [ -f "${script_dir}/docker.conf" ]; then
    source "${script_dir}/docker.conf"
else
    echo "${script_dir}/docker.conf does NOT exist!" >&2
    exit 1
fi

usage="
    [-h|--help:             Show this document.]
    [--no-backup:           Remove the existing image instead of tagging it as backup.]
    [--material-tag <tag>:  The image tag of the builder (e.g. --material-tag 1.0.0).]
"

remove_existing="no"
material_tag="latest"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -h|--help) echo "$usage" >&2; exit 0;;
        --no-backup)
            remove_existing="yes"
            shift;;
        --material-tag)
            if [[ $# -lt 2 || $2 == -* ]]; then
                echo "ERROR: --material-tag requires a value." >&2
                echo "$usage" >&2
                exit 1
            fi
            material_tag="$2"
            shift 2
            ;;
        *) echo "Unsupported option $1" >&2; echo "$usage" >&2; exit 1;
    esac
done

dockerfile="${script_dir}/Dockerfile.builder"
if [ ! -f "${dockerfile}" ]; then
    echo "ERROR: ${dockerfile} not found!" >&2
    exit 1
fi

packages_dir="${material_dir}/builder/${material_tag}"
if [ ! -d "${packages_dir}" ]; then
    echo "WARN: offline store ${packages_dir} not found!" >&2
    exit 1
else
    mkdir -p "${script_dir}/offline"
    cp -r "${packages_dir}/." "${script_dir}/offline/"
fi

cleanup_base="no"
if ! "${docker_bin}" image inspect "${base_image}" &>/dev/null; then
    base_image_tar="${material_dir}/node-base/${base_image//:/-}.tar"
    if [[ -f "${base_image_tar}" ]]; then
        "${docker_bin}" load -i "${base_image_tar}"
    else
        echo "No ${base_image_tar} found!" >&2
        exit 1
    fi

    if ! "${docker_bin}" image inspect "${base_image}" &>/dev/null; then
        echo "Failed to load ${base_image}!"
        exit 1
    fi

    cleanup_base="yes"
fi

builder_name="${image_registry}/${image_namespace}/${project_name}-builder:${builder_version}"

if "${docker_bin}" image inspect "${builder_name}" &>/dev/null; then
    echo "image ${builder_name} already exists."
    if [ "${remove_existing}" = "yes" ]; then
        "${docker_bin}" rmi "${builder_name}"
    else
        time_stamp=$(date +%Y%m%d_%H%M%S)
        random_suffix=$(date +%s%N | md5sum | cut -c1-8)
        "${docker_bin}" tag "${builder_name}" "${builder_name}_${time_stamp}_${random_suffix}"
    fi
fi

build_opts=(
    --build-arg "base_image=${base_image}"
    --build-arg "app_uid=$(id -u)"
    --build-arg "app_gid=$(id -g)"
    --no-cache
    --progress=plain
)

"${docker_bin}" build "${build_opts[@]}" -f "${dockerfile}" -t "${builder_name}" "${script_dir}"

if [ "${cleanup_base}" = "yes" ]; then
    echo "Remove the temporary image ${base_image} ..."
    "${docker_bin}" rmi --force "${base_image}"
    cleanup_base="no"
    echo "Remove successfully!"
fi

