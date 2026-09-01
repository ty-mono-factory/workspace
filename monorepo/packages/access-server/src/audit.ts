import { randomUUID } from 'node:crypto'
import { database } from '@monorepo/database'

export interface AccessAuditInput {
    eventType: string
    outcome: 'SUCCESS' | 'FAILURE'
    providerId: 'credential' | 'access-admin'
    userId?: string
    actorUserId?: string
    targetUserId?: string
    errorCode?: string
    request?: Request
}

export async function recordAccessAudit(input: AccessAuditInput): Promise<void> {
    try {
        await database.client.authAudit.create({
            data: {
                id: randomUUID(),
                eventType: input.eventType,
                outcome: input.outcome,
                providerId: input.providerId,
                userId: input.userId ?? input.actorUserId ?? input.targetUserId,
                actorUserId: input.actorUserId,
                targetUserId: input.targetUserId,
                errorCode: input.errorCode,
                ipAddress: input.request?.headers.get('x-real-ip') ?? undefined,
                userAgent: input.request?.headers.get('user-agent') ?? undefined,
                requestId: input.request?.headers.get('x-request-id') ?? undefined,
            },
        })
    } catch (error) {
        // Authentication must not be rolled back because its secondary audit sink
        // is temporarily unavailable. Never include request data in this log.
        console.error(`[access] failed to record ${input.eventType} audit event`, error)
    }
}

interface AuditableEndpoint {
    eventType: string
    providerId: AccessAuditInput['providerId']
}

function auditableEndpoint(pathname: string): AuditableEndpoint | null {
    if (pathname.endsWith('/sign-in/email') || pathname.endsWith('/sign-in/username')) {
        return { eventType: 'SIGN_IN', providerId: 'credential' }
    }

    if (pathname.endsWith('/sign-out')) {
        return { eventType: 'SIGN_OUT', providerId: 'credential' }
    }

    if (pathname.endsWith('/change-password')) {
        return { eventType: 'PASSWORD_CHANGE', providerId: 'credential' }
    }

    return null
}

export async function auditAccessResponse(
    request: Request,
    response: Response | null,
): Promise<void> {
    const endpoint = auditableEndpoint(new URL(request.url).pathname)
    if (!endpoint) {
        return
    }

    await recordAccessAudit({
        ...endpoint,
        outcome: response?.ok === true ? 'SUCCESS' : 'FAILURE',
        request,
    })
}
