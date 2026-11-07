# Release database migrator (Prisma 7 / SQLite)

Build one release image from the same checkout as the application:

```bash
bash build/dbmigrator/build.sh --release-tag 1.2.3
# Optional: --materials-dir /absolute/path/to/versioned-offline-materials
```

The image embeds schema.prisma, the complete migration history and a plain CJS
config. It does not need a mounted /migration or a repository .env. The Prisma
version comes from the pinned workspace catalog; the offline archive must match.
The host needs Bash/coreutils/Docker, not Node. Existing release tags are refused
locally; configure registry tag immutability separately. Do not build two images
with the same tag concurrently. Nothing is pushed automatically.

Prepare an existing persistent database directory owned by the application UID/GID.
Create an environment file in Docker KEY=value format containing only:

```text
DATABASE_URL=file:/data/access-web.db
```

For an existing SQLite deployment, stop writers and take a consistent backup
before migration. If the existing database has no matching Prisma migration
history, baseline it explicitly first; deploy does not infer that history.
Then run the matching release image exactly once:

```bash
docker run --rm --init --network none --read-only \
  --tmpfs /tmp:rw,nosuid,nodev,mode=1777 \
  --user "$(id -u):$(id -g)" \
  --env-file /etc/mini-factory/database.env \
  --mount type=bind,source=/srv/mini-factory/database,target=/data \
  registry.example.com/mini-factory/mini-factory-dbmigrator:1.2.3
```

Only after exit code 0, start the application with the SAME persistent directory,
DATABASE_URL and compatible UID/GID. Example paths must be adapted to your host.
To inspect status, append `status` to the same docker run command. Other commands
are rejected; this image does not expose migrate dev, reset or db push. Diagnostics
that require unrestricted Prisma commands should be separate operator actions.
The default image user is node (UID 1000), not root; --user may override it.

Do not use file:/tmp/... for deployment. Do not mount migrations from another
release. For SQLite use a local filesystem, not a shared multi-host network volume.
Deployment automation must serialize migrations and stop on any nonzero exit.
There is no automatic rollback: restoring the database and rolling back the app
must be planned together; use compatible migrations for rolling upgrades.

This image targets the current provider=sqlite. Runtime libSQL adapter support
in the app does NOT imply Prisma Migrate supports a remote libsql:// endpoint.
Use that service's supported migration path when introducing a remote database.

The BuildKit offline bind mount is build-time only and intentionally retained.
Offline material checksums and a migration-bundle checksum are verified. Pin the
base image by digest via `build/docker.conf` for reproducible releases. The existing
`build/dbmigrator/manifest` remains the source list for preparing offline Debian packages;
its pinned package versions must be available for the selected base and CPU arch.
Current supplied materials are amd64 / Debian OpenSSL 3.0; prepare separate materials
for aarch64. The bundle must contain the schema-engine binary; prisma --version
and prisma validate run with build networking disabled to detect missing assets.

Build files and the delivery Prisma config live in `build/dbmigrator/`.
`build.sh` packages the schema and migrations from `packages/database/prisma/`
into an isolated temporary image context. Application packaging is independent
and does not produce a database archive. Shared image and material settings live
in `build/docker.conf`; the migrator version is supplied by `--release-tag`.
