import { randomUUID } from 'node:crypto'
import type { Database } from '@monorepo/database'
import { hashPassword } from 'better-auth/crypto'
import { readAccessServerConfig } from './config.js'

export interface InitialAdminInput {
    username: string
    email: string
    displayName: string
    password: string
}

/** Operator-only entry point. Never call this from an HTTP route or startup hook. */
export async function initializeAdmin(
    db: Database,
    input: InitialAdminInput,
    env: NodeJS.ProcessEnv = process.env,
): Promise<{ userId: string }> {
    const username = input.username.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()
    const name = input.displayName.trim()
    const policy = readAccessServerConfig(env).password
    if (!/^[a-z0-9_.]{3,30}$/.test(username)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        || name.length === 0 || name.length > 100
        || input.password.length < policy.minLength
        || input.password.length > policy.maxLength) {
        throw new Error('Invalid administrator identity or password length')
    }

    // Use the same password implementation as the pinned Better Auth version.
    // Hash before taking SQLite's write lock; never log the password or hash.
    const password = await hashPassword(input.password)
    const userId = randomUUID()
    return db.write(async (tx) => {
        // This FIRST write arbitrates concurrent processes at the database level.
        // Conflict is a refusal, never an upsert/reset of existing credentials.
        const claimed = await tx.$executeRaw`
            INSERT INTO "access_initialization" ("key", "userId")
            VALUES ('first-admin', ${userId}) ON CONFLICT ("key") DO NOTHING
        `
        if (claimed !== 1) throw new Error('Administrator initialization is already complete')
        if (await tx.user.count() !== 0) {
            throw new Error('Existing users found; use the separate account recovery procedure')
        }
        await tx.user.create({
            data: {
                id: userId, name, email, username, displayUsername: username,
                emailVerified: false, role: 'admin', banned: false,
            },
        })
        await tx.account.create({
            data: {
                id: randomUUID(), accountId: userId, userId,
                providerId: 'credential', password,
            },
        })
        // Unlike best-effort login auditing, this audit is part of the transaction.
        await tx.authAudit.create({
            data: {
                id: randomUUID(), eventType: 'ADMIN_INITIALIZE', outcome: 'SUCCESS',
                providerId: 'access-admin', userId,
            },
        })
        return { userId }
    })
}
