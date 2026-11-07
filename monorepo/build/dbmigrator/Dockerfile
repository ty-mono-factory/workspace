ARG base_image=node:22.15.0-slim
FROM ${base_image}

ARG prisma_version=7.9.1
WORKDIR /opt/prisma-cli

# Build-time offline installation materials, never application secrets.
RUN --mount=type=bind,source=offline,target=/offline,readonly <<'EOF'
set -eu
export DEBIAN_FRONTEND=noninteractive
cd /offline
sha256sum -c checksum.sha256
APT_OPTS="-o Dir::Etc::sourcelist=/dev/null -o Dir::Etc::sourceparts=/dev/null"
apt-get update ${APT_OPTS}
apt-get install -y --no-install-recommends ${APT_OPTS} /offline/*.deb
tar -xzf "/offline/prisma-cli-${prisma_version}.tgz" -C /opt/prisma-cli
ln -s /opt/prisma-cli/node_modules/.bin/prisma /usr/local/bin/prisma
test "$(node -p "require('/opt/prisma-cli/node_modules/prisma/package.json').version")" = "${prisma_version}"
prisma --version
rm -rf /var/lib/apt/lists/*
mkdir -p /data /migration /opt/dbmigrator
chown node:node /data
EOF

ENV NODE_ENV=production \
    HOME=/tmp \
    CHECKPOINT_DISABLE=1

COPY migration/ /migration/
COPY entrypoint.mjs /opt/dbmigrator/entrypoint.mjs

WORKDIR /migration

RUN sha256sum -c checksum.sha256
USER node

# Validate packaged schema/config offline; never connect to a deployment DB here.
RUN DATABASE_URL=file:/tmp/schema-check.db prisma validate --config /migration/prisma.config.cjs
ARG release_version
LABEL org.opencontainers.image.title="mini-factory database migrator" \
      org.opencontainers.image.version="${release_version}"
ENTRYPOINT ["node", "/opt/dbmigrator/entrypoint.mjs"]
CMD ["deploy"]
