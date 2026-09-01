import { LocalUserManagementError } from '@monorepo/access-server'

export function accessManagementRequest(
    event: Parameters<typeof getRequestURL>[0],
): Request {
    const headers = new Headers()
    for (const [name, value] of Object.entries(getHeaders(event))) {
        if (value !== undefined) {
            headers.set(name, value)
        }
    }

    return new Request(getRequestURL(event).toString(), {
        method: getMethod(event),
        headers,
    })
}

export function throwLocalUserManagementError(error: unknown): never {
    if (error instanceof LocalUserManagementError) {
        throw createError({
            statusCode: error.statusCode,
            statusMessage: error.message,
            data: { code: error.code },
        })
    }

    console.error('[access] unexpected local user management error', error)
    throw createError({
        statusCode: 500,
        statusMessage: 'Local user management failed',
    })
}
