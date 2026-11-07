# syntax=docker/dockerfile:1

ARG base_image=node:22.15.0-slim
FROM ${base_image}

ARG app_gid=1000
ARG app_uid=1000

WORKDIR /workspace

RUN --mount=type=bind,source=offline,target=/workspace/offline <<'EOF'
set -e
APT_OPTS="-o Dir::Etc::sourcelist=/dev/null -o Dir::Etc::sourceparts=/dev/null"
cd /workspace/offline
sha256sum -c checksum.sha256
apt-get update ${APT_OPTS}
apt-get install -y --no-install-recommends ${APT_OPTS} /workspace/offline/*.deb
corepack enable
npm install -g --force /workspace/offline/pnpm-10.34.4.tgz /workspace/offline/turbo-2.5.0.tgz
rm -rf /var/lib/apt/lists/* /tmp/*
getent group "${app_gid}" >/dev/null || groupadd -r app -g "${app_gid}"
getent passwd "${app_uid}" >/dev/null || useradd -r -g app -u "${app_uid}" -d /workspace app
EOF

ENV PNPM_HOME=/workspace/pnpm-store \
    COREPACK_HOME=/workspace/corepack-cache \
    COREPACK_DEFAULT_TO_LATEST=0 \
    PNPM_STORE_DIR=/workspace/pnpm-store/store \
    TURBO_TELEMETRY_DISABLED=1 \
    CCACHE_DIR=/workspace/ccache-storage \
    CCACHE_MAXSIZE=5G \
    CCACHE_COMPRESS=true

RUN cat >> /etc/bash.bashrc <<'EOF'
# mono-builder interactive tweaks
PS1="mono_builder> "
alias ll="ls -la --color=auto"
EOF

CMD ["/bin/bash"]

