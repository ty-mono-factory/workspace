import type { Prisma } from '@prisma/client'
import {
    createDatabaseClient,
    type CreateDatabaseClientOptions,
    type DatabaseClient,
} from './client.js'

export type DatabaseTransactionClient = Prisma.TransactionClient

export type DatabaseRead<T> = (
    client: DatabaseClient,
) => Promise<T>

export type DatabaseWrite<T> = (
    client: DatabaseTransactionClient,
) => Promise<T>

export interface DatabaseWriteOptions {
    /** Maximum time Prisma waits to start the transaction. */
    maxWaitMs?: number
    /** Maximum time the transaction is allowed to run. */
    timeoutMs?: number
}

/**
 * A managed database resource.
 *
 * `read` expresses query intent and reuses the underlying client. `write`
 * executes the callback in an interactive transaction so a command either
 * commits completely or rolls back completely.
 */
export interface Database {
    /** Escape hatch for adapters that need the complete Prisma API. */
    readonly client: DatabaseClient
    readonly isClosed: boolean

    connect(): Promise<void>
    read<T>(operation: DatabaseRead<T>): Promise<T>
    write<T>(
        operation: DatabaseWrite<T>,
        options?: DatabaseWriteOptions,
    ): Promise<T>
    close(): Promise<void>
}

export interface CreateDatabaseOptions extends CreateDatabaseClientOptions {
    /** Allows a generated Prisma client to be injected in tests. */
    client?: DatabaseClient
}

class PrismaDatabase implements Database {
    readonly client: DatabaseClient

    #connectPromise: Promise<void> | undefined
    #closePromise: Promise<void> | undefined
    #closed = false

    constructor(client: DatabaseClient) {
        this.client = client
    }

    get isClosed(): boolean {
        return this.#closed
    }

    connect(): Promise<void> {
        this.#assertOpen()

        if (!this.#connectPromise) {
            this.#connectPromise = this.client.$connect().catch((error: unknown) => {
                this.#connectPromise = undefined
                throw error
            })
        }

        return this.#connectPromise
    }

    async read<T>(operation: DatabaseRead<T>): Promise<T> {
        await this.connect()
        this.#assertOpen()
        return operation(this.client)
    }

    async write<T>(
        operation: DatabaseWrite<T>,
        options: DatabaseWriteOptions = {},
    ): Promise<T> {
        await this.connect()
        this.#assertOpen()

        const transactionOptions = {
            ...(options.maxWaitMs === undefined ? {} : { maxWait: options.maxWaitMs }),
            ...(options.timeoutMs === undefined ? {} : { timeout: options.timeoutMs }),
        }

        return this.client.$transaction(
            operation,
            transactionOptions,
        )
    }

    close(): Promise<void> {
        if (!this.#closePromise) {
            this.#closed = true
            this.#closePromise = (async () => {
                // Avoid disconnecting while a caller is still establishing the shared
                // connection. A failed connection attempt must not prevent cleanup.
                await this.#connectPromise?.catch(() => undefined)
                await this.client.$disconnect()
            })()
        }

        return this.#closePromise
    }

    #assertOpen(): void {
        if (this.#closed) {
            throw new Error('Database resource is closed')
        }
    }
}

export function createDatabase(
    options: CreateDatabaseOptions = {},
): Database {
    const client = options.client ?? createDatabaseClient(options)
    return new PrismaDatabase(client)
}
