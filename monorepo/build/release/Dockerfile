# syntax=docker/dockerfile:1
ARG base_image=node:22.15.0-slim
FROM ${base_image}
RUN --mount=type=bind,source=offline,target=/offline,readonly <<'INSTALL'
set -eu
export DEBIAN_FRONTEND=noninteractive
cd /offline
sha256sum -c checksum.sha256
APT_OPTS="-o Dir::Etc::sourcelist=/dev/null -o Dir::Etc::sourceparts=/dev/null"
apt-get update ${APT_OPTS}
apt-get install -y --no-install-recommends ${APT_OPTS} /offline/*.deb
rm -rf /var/lib/apt/lists/*
mkdir -p /data
chown node:node /data
INSTALL
WORKDIR /app
COPY --chown=node:node application/ ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
ARG release_version
LABEL org.opencontainers.image.version="${release_version}"
USER node
EXPOSE 3000
ENTRYPOINT ["/bin/bash", "./entrypoint.sh"]
