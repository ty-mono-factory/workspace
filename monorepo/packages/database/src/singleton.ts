import {
    createDatabase,
    type Database,
    type DatabaseRead,
    type DatabaseWrite,
    type DatabaseWriteOptions,
} from './database.js'
import type { DatabaseClient } from './client.js'

const GLOBAL_DATABASE_KEY = Symbol.for('monorepo.database.resource')

interface GlobalWithDatabase {
    [GLOBAL_DATABASE_KEY]?: Database
}

/** Returns the one managed database resource owned by this Node.js process. */
export function getDatabase(): Database {
    const globalForDatabase = globalThis as GlobalWithDatabase

    if (!globalForDatabase[GLOBAL_DATABASE_KEY]) {
        globalForDatabase[GLOBAL_DATABASE_KEY] = createDatabase()
    }

    return globalForDatabase[GLOBAL_DATABASE_KEY]
}

/**
 * Recommended application entry point. Prisma connects lazily on first use,
 * so importing this resource does not open a connection immediately.
 */
export const database = getDatabase()

/** @deprecated Prefer the managed `database` resource. */
export const db = database.client

export function readDatabase<T>(operation: DatabaseRead<T>): Promise<T> {
    return database.read(operation)
}

export function writeDatabase<T>(
    operation: DatabaseWrite<T>,
    options?: DatabaseWriteOptions,
): Promise<T> {
    return database.write(operation, options)
}

/** Call once from the host application's graceful-shutdown hook. */
export function closeDatabase(): Promise<void> {
    return database.close()
}

export async function assertDatabaseReady(): Promise<void> {
    await readDatabase(async (client) => {
        await client.$queryRawUnsafe('SELECT 1')
    })
}

/** @deprecated Prefer `database`, `readDatabase` or `writeDatabase`. */
export function getDatabaseClient(): DatabaseClient {
    return db
}

/** @deprecated Prefer `database`, `readDatabase` or `writeDatabase`. */
export const getDb = getDatabaseClient
