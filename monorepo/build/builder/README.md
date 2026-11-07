# Containerized build environment

```bash
bash build/builder/build.sh --material-tag 1.0.0
bash build/builder/launch.sh
bash build/builder/launch.sh --env-file /absolute/path/build.env -- bash build/release/build.sh --project access-web
```

Shared settings are in `build/docker.conf`. Offline builder materials are read
from `${material_dir}/builder/<material-tag>`; `manifest` lists Debian dependencies.
The launcher mounts the workspace parent at `/workspace`, starts in
`/workspace/monorepo`, and defaults to the monorepo `.env` in Docker env-file format.
The container provides the compilation toolchain; application packaging is in
`build/release/build.sh`.
