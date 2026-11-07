# Access Web delivery
The application archive is artifacts/access-web.tar.gz.
Build it with `bash build/release/build.sh --project access-web`.
Build its runtime image with `bash build/release/image.sh --project access-web --release-tag 1.2.3`.

For database deployment use the release migrator procedure in
[dbmigrator README](../../build/dbmigrator/README.md).
Run the migrator before starting this application's matching release. Both
containers must use the same persistent database directory and DATABASE_URL.
