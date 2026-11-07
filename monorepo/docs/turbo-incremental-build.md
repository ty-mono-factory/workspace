# Incremental builds

Use the repository entry points inside the existing builder container:

```bash
pnpm build
pnpm build --filter=@monorepo/ty-demo-app...
pnpm build:plan
```

Ordinary `pnpm build` uses incremental task caching. Do not run `clean` or delete
`.turbo` before ordinary builds. Keep the builder image and package-manager
versions fixed. Run install with the existing frozen lockfile.

For delivery, `bash build/release/build.sh --project ty-demo-app` deliberately
runs a clean build: install with the frozen lockfile, clean workspace outputs,
then force the selected app and all dependency build tasks to execute without
cache reuse. It always repackages delivery files, even for delivery-only changes.

Use the root scripts rather than `pnpm -r build`, filtered package `build`,
or direct `turbo` commands: the root launcher fingerprints the native toolchain.
Database mutation commands remain uncached. This change does not load .env files. Current Nuxt commands disable dotenv loading,
and Prisma requires DATABASE_URL to be injected. Continue supplying environment
variables through the builder env-file or your shell. The launcher hashes the
root .env file into a task-scoped fingerprint without printing its contents;
env declarations also hash externally supplied values.

Cache boundaries:

- Nuxt pages/server/utils/config changes rebuild the affected app.
- Database schema changes regenerate Prisma, then invalidate its consumers.
- Database handwritten TS changes do not regenerate Prisma.
- Native C/C++/headers/gyp/toolchain changes rebuild the addon and its consumers.
- Native package TS-only changes skip addon compilation.
- Source-only config/types packages use Turbo transit nodes; their source changes
  invalidate consumers without introducing fake compilation tasks.
- access-server remains source-exported and its build checks types without
  emitting unused dist files; database follows the same source-export pattern.
- logger and ty-demo restore dist; Prisma restores generated sources; Nuxt
  restores .output. .nuxt is temporary and is not required by delivery.

For a cache audit, build twice without edits, then change a page, header,
schema, handwritten database source and delivery file separately in a disposable
checkout. Inspect hashes using `pnpm build:plan`; confirm second builds hit cache
and deleting only declared outputs allows restoration. Turbo caches whole tasks;
it does not perform per-file C++ compilation. node-gyp rebuild still rebuilds the
addon after a native cache miss.

No dependency versions or dependency edges were changed, so the pnpm lockfile
requires no regeneration. Existing unrelated lint configuration and type errors
are outside this patch; a failed build is never a successful cache entry.

## Local development

Your existing sequence remains valid:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

The first build after this configuration change will generally miss the old
cache. Subsequent unchanged tasks can reuse it. `dev` itself is never cached;
its dependency builds can reuse the build cache. Ordinary Nuxt edits still use
HMR. After native addon changes, rebuild the dependency and restart the dev server
if it has already loaded that addon. Do not clean caches before routine builds.

