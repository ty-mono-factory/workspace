# `@monorepo/database`

This package owns the Prisma/libSQL client lifecycle and exposes explicit read
and transactional-write boundaries.

## Application usage

Use the process-scoped resource in long-running application code:

```ts
import { database } from '@monorepo/database'

const user = await database.read((db) =>
  db.user.findUnique({ where: { id: userId } }),
)

await database.write(async (tx) => {
  await tx.user.update({
    where: { id: userId },
    data: { status: 'NORMAL' },
  })
  await tx.session.deleteMany({ where: { userId } })
})
```

`write` is an interactive transaction. Keep its callback short and do not put
network calls or other irreversible side effects inside it.

`read` is an intent boundary, not a database permission boundary. If reads must
be physically isolated from writes, inject a read-only database user or replica
behind a separate adapter rather than relying on TypeScript alone.

Call `closeDatabase()` from the host application's graceful-shutdown hook. Do
not connect and disconnect for every request.

## Isolated usage

Tests, one-shot scripts and independently managed workers can own a resource:

```ts
import { createDatabase } from '@monorepo/database'

const isolatedDatabase = createDatabase({
  databaseUrl: 'file:./test.db',
})

try {
  await isolatedDatabase.read((db) => db.user.count())
} finally {
  await isolatedDatabase.close()
}
```

## Process model

`database` is a singleton per JavaScript process, not a cluster-wide singleton.
With four server processes there are four Prisma/libSQL resources. That is the
correct ownership boundary: JavaScript objects and live connections cannot be
shared safely across processes.

Connection capacity must therefore be budgeted across all processes. Local
SQLite/libSQL remains a single-writer database even when WAL is used. Keep write
transactions short; if sustained concurrent writes across processes are a
requirement, use a remote libSQL service or a client/server database rather than
adding more local clients.

`getDb()` and `getDatabaseClient()` remain temporarily available as deprecated
compatibility APIs. New code should depend on `Database`, `database.read()` and
`database.write()`.
