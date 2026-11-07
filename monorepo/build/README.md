# Build and delivery

- `builder/`: build and launch the containerized compilation environment.
- `release/`: package application output and build application runtime images.
- `dbmigrator/`: build a release-specific database migration image independently.
- `docker.conf`: shared image registry, builder version, base image and material paths.

Run commands from the monorepo root:

```bash
bash build/builder/build.sh --material-tag 1.0.0
bash build/builder/launch.sh
# Inside the builder, or on a host with the workspace Node/pnpm toolchain:
bash build/release/build.sh --project access-web
# On a Docker host with the resulting artifacts and offline materials:
bash build/release/image.sh --project access-web --release-tag 1.2.3
bash build/dbmigrator/build.sh --release-tag 1.2.3
```

Run the matching dbmigrator successfully before starting the application release.
See each component's README for details. Nothing is pushed automatically.
