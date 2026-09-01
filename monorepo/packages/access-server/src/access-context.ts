import { getAccessSession } from './auth.js'

export interface AccessUser {
    id: string
    name: string
    email: string
    username: string | null
    roles: string[]
}

export type AccessContext =
    | {
        authenticated: false
        user: null
        session: null
    }
    | {
        authenticated: true
        user: AccessUser
        session: {
            id: string
            expiresAt: Date
        }
    }

function rolesFrom(value: string | null | undefined): string[] {
    return value
        ?.split(',')
        .map((role) => role.trim())
        .filter(Boolean) ?? []
}

export async function resolveAccessContext(
    headers: Headers,
): Promise<AccessContext> {
    const result = await getAccessSession(headers)

    if (!result || result.user.banned === true) {
        return {
            authenticated: false,
            user: null,
            session: null,
        }
    }

    return {
        authenticated: true,
        user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            username: result.user.username ?? null,
            roles: rolesFrom(result.user.role),
        },
        session: {
            id: result.session.id,
            expiresAt: result.session.expiresAt,
        },
    }
}
