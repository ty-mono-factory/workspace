# Application delivery

```bash
bash build/release/build.sh --project access-web
bash build/release/image.sh --project access-web --release-tag 1.2.3
```

`build.sh` needs the workspace Node/pnpm toolchain (locally or in the builder).
It installs dependencies with the frozen lockfile, runs `pnpm clean` across the
workspace, and forces every build task for the selected app and its dependencies
to execute with Turbo `--force`, including Prisma generation and native addons
when required. Previous build results are not reused, including remote cache.
Other apps are cleaned but not built unless they are dependencies.
It packages the application's `.output` and `apps/<app>/delivery/` files into
`artifacts/<app>/` and `artifacts/<app>.tar.gz`. It does not package migrations.
Use `--clean` or `--clean --project access-web` to clean generated files.

`image.sh` needs Docker and consumes the existing `artifacts/<app>/` directory.
The application must supply `delivery/entrypoint.sh`, run by Bash from `/app`.
Offline Debian runtime packages and `checksum.sha256` must be prepared under
`${material_dir}/runtime/deps/<app>` (or use `--materials-dir /absolute/path`).
The application's `delivery/manifest` describes its required runtime packages.
Build networking is disabled; base-image settings come from `build/docker.conf`.
Existing local release tags are refused. Nothing is pushed automatically.

For access-web, run the matching dbmigrator release first, then start the app:

```bash
docker run --rm --init --env-file /etc/mini-factory/database.env \
  --mount type=bind,source=/srv/mini-factory/database,target=/data \
  -p 3000:3000 \
  registry.example.com/mini-factory/mini-factory-access-web:1.2.3
```

Adapt the image name to `docker.conf` and your checkout's project name. Supply
application settings at runtime and use the same database URL, persistent storage
and compatible UID/GID as the migrator. The default runtime user is node (UID 1000).
See `build/dbmigrator/README.md` for migration and backup procedures.

## First administrator (access-web only)

After database migration, explicitly run `admin-init` from the application release
image for a new installation, then start the web service. Application startup
never creates users. See the [Access Web configuration and operations guide](../../apps/access-web/README.md#4-首个管理员显式执行-admin-init)
for secret-file permissions, local development, deployment commands, existing
database upgrades and the one-time transaction guarantee.
