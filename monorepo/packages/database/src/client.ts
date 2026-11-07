import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from './generated/client.js'
export type { Prisma } from './generated/client.js'

export type DatabaseClient = PrismaClient

export interface CreateDatabaseClientOptions {
    databaseUrl?: string
    authToken?: string
}

function resolveDatabaseUrl(options: CreateDatabaseClientOptions): string {
    const url = options.databaseUrl ?? process.env.DATABASE_URL
    if (!url || url.trim() === '') {
        throw new Error('DATABASE_URL is required; inject it before starting the process')
    }
    return url
}

function resolveAuthToken(
    options: CreateDatabaseClientOptions,
): string | undefined {
    const authToken = options.authToken
        ?? process.env.DATABASE_AUTH_TOKEN
        ?? process.env.TURSO_AUTH_TOKEN

    return authToken?.trim() || undefined
}

/**
 * Creates an isolated Prisma client.
 *
 * Application code should normally use the process-scoped `database` resource
 * instead. This factory is intended for tests, short-lived scripts and workers
 * that own an independent lifecycle.
 */
export function createDatabaseClient(
    options: CreateDatabaseClientOptions = {},
): DatabaseClient {
    const adapter = new PrismaLibSql({
        url: resolveDatabaseUrl(options),
        authToken: resolveAuthToken(options),
    })

    return new PrismaClient({ adapter })
}
