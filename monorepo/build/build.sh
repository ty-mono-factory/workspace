#!/usr/bin/env bash

set -Eeuo pipefail

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repo_root="$(CDPATH= cd -- "${script_dir}/.." && pwd)"

usage() {
    cat >&2 <<'EOF'
Usage:
  build.sh --project <app>              Clean the workspace, build the app and package it
  build.sh --clean [--project <app>]    Clean all generated files, or only one app
EOF
}

PROJECT=""
clean_only="no"
while [[ $# -gt 0 ]]; do
    case "$1" in
        -p|--project)
            [[ $# -ge 2 && -n "$2" ]] || { echo "error: --project needs a value" >&2; usage; exit 1; }
            PROJECT="$2"
            shift 2
            ;;
        --clean)
            clean_only="yes"
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
    pnpm clean
    rm -rf "${repo_root}/build/artifacts"
}

clean_project() {
    local project="$1"
    local app_dir="${repo_root}/apps/${project}"

    [[ "${project}" != */* && "${project}" != .* && "${project}" != *..* ]] || {
        echo "error: invalid project name: ${project}" >&2
        exit 1
    }

    [[ -d "${app_dir}" ]] || {
        echo "error: app directory does not exist: ${app_dir}" >&2
        exit 1
    }

    echo ">>> cleaning app: ${project}"
    pnpm --filter "${app_dir}" clean

    rm -rf "${repo_root}/build/artifacts/${project}"
    rm -rf "${repo_root}/build/artifacts/${project}.tar.gz"
}

cd "${repo_root}"

command -v pnpm >/dev/null 2>&1 || {
    echo "error: pnpm is required; expected pnpm 10.34.4" >&2
    exit 1
}

if [[ "${clean_only}" == "yes" ]]; then
    if [[ -n "${PROJECT}" ]]; then
        clean_project "${PROJECT}"
    else
        clean_workspace
    fi
    exit 0
fi

[[ -n "${PROJECT}" ]] || {
    echo "error: --project is required when building" >&2
    usage
    exit 1
}

[[ "${PROJECT}" != */* && "${PROJECT}" != .* && "${PROJECT}" != *..* ]] || {
    echo "error: invalid project name: ${PROJECT}" >&2
    exit 1
}

app_dir="${repo_root}/apps/${PROJECT}"
delivery_dir="${app_dir}/delivery"
artifacts_dir="${repo_root}/build/artifacts/${PROJECT}"
tarball="${repo_root}/build/artifacts/${PROJECT}.tar.gz"

rm -rf "${artifacts_dir}" "${tarball}"

echo ">>> installing workspace dependencies"
pnpm install --frozen-lockfile

echo ">>> building app: ${PROJECT}"
pnpm --filter "@monorepo/${PROJECT}" build

mkdir -p "${artifacts_dir}"

echo ">>> installing application"
[[ -d "${app_dir}/.output" ]] || {
    echo "error: build did not produce ${app_dir}/.output" >&2
    exit 1
}
cp -r "${app_dir}/.output" "${artifacts_dir}/${PROJECT}"

echo ">>> installing delivery user files"
if [[ -d "${delivery_dir}" ]]; then
    cp -r "${delivery_dir}/." "${artifacts_dir}/"
fi
rm -rf "${artifacts_dir}"/manifest

echo ">>> created ${tarball}"
tar -czf "${tarball}" -C "${artifacts_dir}" .

echo ">>> Build successfully!"
