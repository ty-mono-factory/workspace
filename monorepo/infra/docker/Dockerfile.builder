ARG BASE_IMAGE=node:22.15.0-slim
FROM ${BASE_IMAGE}

ARG APP_GID=1000
ARG APP_UID=1000
ARG OFFLINE_MODE=yes
ARG USE_CN_MIRROR=no

WORKDIR /workspace

# known issue: the offline may not existed on on-line mode.
COPY infra/docker/offline /workspace/offline

RUN set -ex; \
    if [ "$OFFLINE_MODE" = "yes" ]; then \
        echo ">>> off line mode"; \
        cd /workspace/offline && sha256sum -c checksum.sha256; \
        apt-get update -o Dir::Etc::sourcelist=/dev/null -o Dir::Etc::sourceparts=/dev/null; \
        apt-get install -y --no-install-recommends \
            -o Dir::Etc::sourcelist=/dev/null \
            -o Dir::Etc::sourceparts=/dev/null \
            /workspace/offline/*.deb; \
        \
        corepack enable; \
        npm install -g --force \
            /workspace/offline/pnpm-10.34.4.tgz \
            /workspace/offline/turbo-2.5.0.tgz \
            --prefix=/usr/local; \
    else \
        echo ">>> on line mode"; \
        if [ "$USE_CN_MIRROR" = "yes" ]; then \
            echo ">>> on Chinese mirror"; \
            apt-get update; \
            apt-get install -y --no-install-recommends curl ca-certificates; \
            sed -i 's|https\?://deb\.debian\.org|https://mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources; \
            sed -i 's|https\?://security\.debian\.org|https://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources; \
            apt-get update; \
            apt-get install -y --no-install-recommends \
            git \
            openssh-client \
            g++ \
            make \
            ccache \
            cmake \
            ninja-build \
            libssl-dev \
            libc6-dev \
            pkg-config \
            vim \
            python3; \
        else \
            echo ">>> on InterNet"; \
            apt-get update; \
            apt-get install -y --no-install-recommends \
            curl \
            ca-certificates \
            git \
            openssh-client \
            g++ \
            make \
            ccache \
            cmake \
            ninja-build \
            libssl-dev \
            libc6-dev \
            pkg-config \
            vim \
            python3; \
        fi; \
        \
        corepack enable; \
        npm install -g --force pnpm@10.34.4 turbo@2.5.0 --prefix=/usr/local; \
    fi; \
    \
    rm -rf /var/lib/apt/lists/* /tmp/*; \
    \
    getent group "${APP_GID}" >/dev/null || groupadd -r app -g "${APP_GID}"; \
    getent passwd "${APP_UID}" >/dev/null || useradd -r -g app -u "${APP_UID}" -d /workspace app

ENV PNPM_HOME=/workspace/pnpm-store \
    COREPACK_HOME=/workspace/corepack-cache \
    COREPACK_DEFAULT_TO_LATEST=0 \
    PNPM_STORE_DIR=/workspace/pnpm-store/store \
    TURBO_TELEMETRY_DISABLED=1 \
    CCACHE_DIR=/workspace/ccache-storage \
    CCACHE_MAXSIZE=5G \
    CCACHE_COMPRESS=true

RUN echo '\nPS1="mono_builder> "' >> /etc/bash.bashrc \
    && echo 'alias ll="ls -la --color=auto"' >> /etc/bash.bashrc

COPY infra/docker/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/bin/bash"]

# Build commands:
# create_docker_image.sh # Recommanded
# docker build -f Dockerfile.builder -t monorepo-builder:1.0.0 . 2>&1 | tee docker_build.log
