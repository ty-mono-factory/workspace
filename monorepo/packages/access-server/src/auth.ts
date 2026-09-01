import { database } from '@monorepo/database'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, username } from 'better-auth/plugins'
import { auditAccessResponse } from './audit.js'
import { readAccessServerConfig } from './config.js'

const config = readAccessServerConfig()

/**
 * The only authentication engine instance in the repository.
 *
 * Hosts expose its handler, while application code consumes AccessContext
 * rather than importing this object.
 */
const accessAuth = betterAuth({
    appName: 'Access Subsystem',
    basePath: config.basePath,
    baseURL: config.baseUrl,
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    disabledPaths: ['/is-username-available'],
    rateLimit: {
        enabled: true,
    },
    database: prismaAdapter(database.client, {
        provider: 'sqlite',
    }),
    emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        minPasswordLength: config.password.minLength,
        maxPasswordLength: config.password.maxLength,
    },
    session: {
        expiresIn: config.sessionExpiresInSeconds,
    },
    plugins: [
        username({
            minUsernameLength: 3,
            maxUsernameLength: 30,
        }),
        admin({
            defaultRole: 'user',
            adminRoles: ['admin'],
        }),
    ],
})

export interface AccessSession {
    user: {
        id: string
        name: string
        email: string
        username: string | null
        role: string | null
        banned: boolean | null
    }
    session: {
        id: string
        expiresAt: Date
    }
}

export interface CreateBootstrapAdminInput {
    email: string
    password: string
    name: string
    username: string
}

export interface CreateAccessLocalUserInput {
    email: string
    password: string
    name: string
    username: string
    role: 'user' | 'admin'
}

/** Keeps Better Auth's implementation-specific inferred type inside this module. */
export async function getAccessSession(headers: Headers): Promise<AccessSession | null> {
    const result = await accessAuth.api.getSession({ headers })
    if (!result) {
        return null
    }

    return {
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            username: result.user.username ?? null,
            role: result.user.role ?? null,
            banned: result.user.banned ?? null,
        },
        session: {
            id: result.session.id,
            expiresAt: result.session.expiresAt,
        },
    }
}

export async function createBootstrapAdmin(
    input: CreateBootstrapAdminInput,
): Promise<{ userId: string }> {
    const created = await accessAuth.api.createUser({
        body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: 'admin',
            data: {
                username: input.username,
                displayUsername: input.username,
            },
        },
    })

    return { userId: created.user.id }
}

export async function createAccessLocalUser(
    input: CreateAccessLocalUserInput,
): Promise<{ userId: string }> {
    const created = await accessAuth.api.createUser({
        body: {
            email: input.email,
            password: input.password,
            name: input.name,
            role: input.role,
            data: {
                username: input.username,
                displayUsername: input.username,
            },
        },
    })

    return { userId: created.user.id }
}

export async function updateAccessLocalUserName(
    headers: Headers,
    userId: string,
    name: string,
): Promise<void> {
    await accessAuth.api.adminUpdateUser({
        headers,
        body: {
            userId,
            data: {
                name,
            },
        },
    })
}

export async function setAccessLocalUserRole(
    headers: Headers,
    userId: string,
    role: 'user' | 'admin',
): Promise<void> {
    await accessAuth.api.setRole({
        headers,
        body: { userId, role },
    })
}

export async function disableAccessLocalUser(
    headers: Headers,
    userId: string,
): Promise<void> {
    await accessAuth.api.banUser({
        headers,
        body: {
            userId,
            banReason: 'Disabled by an access administrator',
        },
    })
    await accessAuth.api.revokeUserSessions({
        headers,
        body: { userId },
    })
}

export async function restoreAccessLocalUser(
    headers: Headers,
    userId: string,
): Promise<void> {
    await accessAuth.api.unbanUser({
        headers,
        body: { userId },
    })
}

export async function resetAccessLocalUserPassword(
    headers: Headers,
    userId: string,
    newPassword: string,
): Promise<void> {
    await accessAuth.api.setUserPassword({
        headers,
        body: { userId, newPassword },
    })
    await accessAuth.api.revokeUserSessions({
        headers,
        body: { userId },
    })
}

export async function revokeAccessLocalUserSessions(
    headers: Headers,
    userId: string,
): Promise<void> {
    await accessAuth.api.revokeUserSessions({
        headers,
        body: { userId },
    })
}

export async function handleAccessRequest(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname
    if (pathname.startsWith(`${config.basePath}/admin/`)) {
        return Response.json(
            { code: 'ADMIN_ROUTE_NOT_EXPOSED', message: 'Use the Access management API' },
            { status: 404 },
        )
    }

    try {
        const response = await accessAuth.handler(request)
        await auditAccessResponse(request, response)
        return response
    } catch (error) {
        await auditAccessResponse(request, null)
        throw error
    }
}
