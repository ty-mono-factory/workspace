import { database } from '@monorepo/database'
import { recordAccessAudit } from './audit.js'
import { createBootstrapAdmin } from './auth.js'
import { readAccessServerConfig } from './config.js'

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/

export type BootstrapAdminResult =
    | { status: 'disabled' }
    | { status: 'already-exists'; userId: string }
    | { status: 'created'; userId: string }

interface BootstrapAdminInput {
    username: string
    email: string
    displayName: string
    password: string
}

function readBootstrapInput(env: NodeJS.ProcessEnv): BootstrapAdminInput | null {
    if (env.ACCESS_BOOTSTRAP_ADMIN_ENABLED !== 'true') {
        return null
    }

    const input = {
        username: (env.ACCESS_BOOTSTRAP_ADMIN_USERNAME ?? 'admin').trim().toLowerCase(),
        email: (env.ACCESS_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@localhost.local').trim().toLowerCase(),
        displayName: (env.ACCESS_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Admin').trim(),
        password: env.ACCESS_BOOTSTRAP_ADMIN_PASSWORD ?? '',
    }
    const passwordPolicy = readAccessServerConfig(env).password

    if (
        input.username.length < 3
        || input.username.length > 30
        || !USERNAME_PATTERN.test(input.username)
    ) {
        throw new Error('Bootstrap admin username must be 3-30 safe characters')
    }

    if (!/^\S+@\S+\.\S+$/.test(input.email)) {
        throw new Error('Bootstrap admin email is invalid')
    }

    if (input.displayName.length === 0 || input.displayName.length > 100) {
        throw new Error('Bootstrap admin display name must be 1-100 characters')
    }

    if (
        input.password.length < passwordPolicy.minLength
        || input.password.length > passwordPolicy.maxLength
    ) {
        throw new Error(
            `Bootstrap admin password must be ${passwordPolicy.minLength}-${passwordPolicy.maxLength} characters`,
        )
    }

    return input
}

/** Development-only first administrator provisioning through Better Auth. */
export async function bootstrapAdminFromEnvironment(
    env: NodeJS.ProcessEnv = process.env,
): Promise<BootstrapAdminResult> {
    const input = readBootstrapInput(env)
    if (!input) {
        return { status: 'disabled' }
    }

    const existing = await database.client.user.findFirst({
        where: {
            OR: [
                { username: input.username },
                { email: input.email },
            ],
        },
        select: {
            id: true,
            role: true,
            accounts: {
                where: { providerId: 'credential' },
                select: { id: true },
                take: 1,
            },
        },
    })

    if (existing) {
        const roles = existing.role?.split(',').map((role) => role.trim()) ?? []
        if (existing.accounts.length === 0 || !roles.includes('admin')) {
            throw new Error(
                'Bootstrap identity exists without a Better Auth admin credential; reset development auth data instead of migrating the legacy password',
            )
        }

        return { status: 'already-exists', userId: existing.id }
    }

    try {
        const created = await createBootstrapAdmin({
            email: input.email,
            password: input.password,
            name: input.displayName,
            username: input.username,
        })

        await recordAccessAudit({
            eventType: 'BOOTSTRAP_ADMIN_CREATE',
            outcome: 'SUCCESS',
            providerId: 'access-admin',
            userId: created.userId,
        })

        return { status: 'created', userId: created.userId }
    } catch (error) {
        await recordAccessAudit({
            eventType: 'BOOTSTRAP_ADMIN_CREATE',
            outcome: 'FAILURE',
            providerId: 'access-admin',
        })
        throw error
    }
}
