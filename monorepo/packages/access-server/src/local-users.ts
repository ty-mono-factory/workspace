import { database } from '@monorepo/database'
import { createProcessAdminReductionCoordinator } from './admin-reduction-coordinator.js'
import { recordAccessAudit } from './audit.js'
import {
    createAccessLocalUser,
    disableAccessLocalUser,
    getAccessSession,
    resetAccessLocalUserPassword,
    restoreAccessLocalUser,
    revokeAccessLocalUserSessions,
    setAccessLocalUserRole,
    updateAccessLocalUserName,
} from './auth.js'
import { readAccessServerConfig } from './config.js'
import {
    accessRoles,
    evaluateLocalUserMutation,
    isActiveAdmin,
    reducesActiveAdminSet,
    type LocalAccessRole,
    type LocalUserPolicySubject,
    type ProtectedLocalUserAction,
} from './local-user-policy.js'
import { createProcessUserMutationCoordinator } from './user-mutation-coordinator.js'

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/
const config = readAccessServerConfig()
const adminReductionCoordinator = createProcessAdminReductionCoordinator()
const userMutationCoordinator = createProcessUserMutationCoordinator()

export type LocalUserManagementErrorCode =
    | 'CANNOT_MANAGE_SELF'
    | 'INVALID_INPUT'
    | 'LAST_ADMIN_REQUIRED'
    | 'LOCAL_USER_OPERATION_FAILED'
    | 'LOCAL_USER_NOT_FOUND'
    | 'ORIGIN_NOT_ALLOWED'
    | 'REQUIRES_ADMIN'
    | 'REQUIRES_AUTHENTICATION'

export class LocalUserManagementError extends Error {
    readonly code: LocalUserManagementErrorCode
    readonly statusCode: number

    constructor(
        code: LocalUserManagementErrorCode,
        statusCode: number,
        message: string,
    ) {
        super(message)
        this.name = 'LocalUserManagementError'
        this.code = code
        this.statusCode = statusCode
    }
}

export interface LocalUserSummary {
    id: string
    name: string
    email: string
    username: string | null
    role: LocalAccessRole
    disabled: boolean
    createdAt: string
    sessionCount: number
    isCurrentUser: boolean
    isLastActiveAdmin: boolean
}

export interface LocalUserList {
    currentUserId: string
    users: LocalUserSummary[]
}

interface Administrator {
    id: string
}

interface AuditedMutationResult<T> {
    value: T
    targetUserId?: string
}

type LocalUserCommand =
    | { action: 'disable' }
    | { action: 'reset-password'; newPassword: string }
    | { action: 'restore' }
    | { action: 'revoke-sessions' }
    | { action: 'set-role'; role: LocalAccessRole }
    | { action: 'update-name'; name: string }

function inputObject(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new LocalUserManagementError('INVALID_INPUT', 400, 'Request body must be an object')
    }

    return input as Record<string, unknown>
}

function requiredString(
    input: Record<string, unknown>,
    key: string,
    label: string,
): string {
    const value = input[key]
    if (typeof value !== 'string' || value.trim() === '') {
        throw new LocalUserManagementError('INVALID_INPUT', 400, `${label} is required`)
    }

    return value.trim()
}

function requiredPasswordString(
    input: Record<string, unknown>,
    key: string,
    label: string,
): string {
    const value = input[key]
    if (typeof value !== 'string' || value.length === 0) {
        throw new LocalUserManagementError('INVALID_INPUT', 400, `${label} is required`)
    }

    return value
}

function localRole(value: unknown): LocalAccessRole {
    if (value !== 'user' && value !== 'admin') {
        throw new LocalUserManagementError('INVALID_INPUT', 400, 'Role must be user or admin')
    }

    return value
}

function displayName(value: string): string {
    if (value.length > 100) {
        throw new LocalUserManagementError(
            'INVALID_INPUT',
            400,
            'Display name must contain 1-100 characters',
        )
    }

    return value
}

function password(value: string): string {
    if (
        value.length < config.password.minLength
        || value.length > config.password.maxLength
    ) {
        throw new LocalUserManagementError(
            'INVALID_INPUT',
            400,
            `Password must contain ${config.password.minLength}-${config.password.maxLength} characters`,
        )
    }

    return value
}

function parseCreateInput(input: unknown) {
    const body = inputObject(input)
    const username = requiredString(body, 'username', 'Username').toLowerCase()
    const email = requiredString(body, 'email', 'Email').toLowerCase()
    const name = displayName(requiredString(body, 'name', 'Display name'))

    if (
        username.length < 3
        || username.length > 30
        || !USERNAME_PATTERN.test(username)
    ) {
        throw new LocalUserManagementError(
            'INVALID_INPUT',
            400,
            'Username must be 3-30 letters, digits, underscores or dots',
        )
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new LocalUserManagementError('INVALID_INPUT', 400, 'Email is invalid')
    }

    return {
        username,
        email,
        name,
        password: password(requiredPasswordString(body, 'password', 'Password')),
        role: localRole(body.role),
    }
}

function parseCommand(input: unknown): LocalUserCommand {
    const body = inputObject(input)
    const action = requiredString(body, 'action', 'Action')

    switch (action) {
        case 'disable':
        case 'restore':
        case 'revoke-sessions':
            return { action }
        case 'reset-password':
            return {
                action,
                newPassword: password(requiredPasswordString(body, 'newPassword', 'New password')),
            }
        case 'set-role':
            return {
                action,
                role: localRole(body.role),
            }
        case 'update-name':
            return {
                action,
                name: displayName(requiredString(body, 'name', 'Display name')),
            }
        default:
            throw new LocalUserManagementError('INVALID_INPUT', 400, 'Unsupported user action')
    }
}

function commandAuditEventType(input: unknown): string {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        return 'LOCAL_USER_COMMAND'
    }

    const action = (input as Record<string, unknown>).action
    if (
        action !== 'disable'
        && action !== 'reset-password'
        && action !== 'restore'
        && action !== 'revoke-sessions'
        && action !== 'set-role'
        && action !== 'update-name'
    ) {
        return 'LOCAL_USER_COMMAND'
    }

    return `LOCAL_USER_${action.replaceAll('-', '_').toUpperCase()}`
}

function assertMutationOrigin(request: Request): void {
    const origin = request.headers.get('origin')
    if (origin !== config.baseUrl) {
        throw new LocalUserManagementError(
            'ORIGIN_NOT_ALLOWED',
            403,
            'The request origin is not allowed',
        )
    }
}

async function requireAdministrator(headers: Headers): Promise<Administrator> {
    const session = await getAccessSession(headers)
    if (!session || session.user.banned === true) {
        throw new LocalUserManagementError(
            'REQUIRES_AUTHENTICATION',
            401,
            'Authentication is required',
        )
    }

    if (!accessRoles(session.user.role).includes('admin')) {
        throw new LocalUserManagementError(
            'REQUIRES_ADMIN',
            403,
            'Administrator access is required',
        )
    }

    return { id: session.user.id }
}

function managementError(error: unknown): LocalUserManagementError {
    if (error instanceof LocalUserManagementError) {
        return error
    }

    return new LocalUserManagementError(
        'LOCAL_USER_OPERATION_FAILED',
        400,
        error instanceof Error ? error.message : 'Local user operation failed',
    )
}

async function runAuditedMutation<T>(
    eventType: string,
    request: Request,
    initialTargetUserId: string | undefined,
    operation: (actor: Administrator) => Promise<AuditedMutationResult<T>>,
): Promise<T> {
    let actorUserId: string | undefined
    let targetUserId = initialTargetUserId

    try {
        assertMutationOrigin(request)
        const actor = await requireAdministrator(request.headers)
        actorUserId = actor.id
        const result = await operation(actor)
        targetUserId = result.targetUserId ?? targetUserId

        await recordAccessAudit({
            eventType,
            outcome: 'SUCCESS',
            providerId: 'access-admin',
            actorUserId,
            targetUserId,
            request,
        })

        return result.value
    } catch (error) {
        const normalized = managementError(error)
        await recordAccessAudit({
            eventType,
            outcome: 'FAILURE',
            providerId: 'access-admin',
            actorUserId,
            targetUserId,
            errorCode: normalized.code,
            request,
        })
        throw normalized
    }
}

async function mutationSubjects(targetUserId: string): Promise<{
    target: LocalUserPolicySubject
    activeAdminCount: number
}> {
    const users = await database.read((client) => client.user.findMany({
        select: {
            id: true,
            role: true,
            banned: true,
        },
    }))
    const target = users.find((user) => user.id === targetUserId)
    if (!target) {
        throw new LocalUserManagementError(
            'LOCAL_USER_NOT_FOUND',
            404,
            'Local user was not found',
        )
    }

    return {
        target,
        activeAdminCount: users.filter(isActiveAdmin).length,
    }
}

async function mutationTarget(targetUserId: string): Promise<LocalUserPolicySubject> {
    const target = await database.read((client) => client.user.findUnique({
        where: { id: targetUserId },
        select: {
            id: true,
            role: true,
            banned: true,
        },
    }))
    if (!target) {
        throw new LocalUserManagementError(
            'LOCAL_USER_NOT_FOUND',
            404,
            'Local user was not found',
        )
    }

    return target
}

function protectedAction(command: LocalUserCommand): ProtectedLocalUserAction | null {
    switch (command.action) {
        case 'disable':
        case 'reset-password':
        case 'revoke-sessions':
        case 'set-role':
            return command.action
        case 'restore':
        case 'update-name':
            return null
    }

    const unsupported: never = command
    return unsupported
}

function commandReducesActiveAdminSet(
    target: LocalUserPolicySubject,
    command: LocalUserCommand,
): boolean {
    switch (command.action) {
        case 'disable':
            return reducesActiveAdminSet(target, command.action)
        case 'set-role':
            return reducesActiveAdminSet(target, command.action, command.role)
        default:
            return false
    }
}

function assertSelfMutationAllowed(
    actorId: string,
    target: LocalUserPolicySubject,
    command: LocalUserCommand,
): void {
    if (protectedAction(command) !== null && actorId === target.id) {
        throw new LocalUserManagementError(
            'CANNOT_MANAGE_SELF',
            409,
            'Use the personal account controls for your own account',
        )
    }
}

async function applyLocalUserCommand(
    headers: Headers,
    targetUserId: string,
    command: LocalUserCommand,
): Promise<void> {
    switch (command.action) {
        case 'update-name':
            await updateAccessLocalUserName(headers, targetUserId, command.name)
            break
        case 'set-role':
            await setAccessLocalUserRole(headers, targetUserId, command.role)
            break
        case 'disable':
            await disableAccessLocalUser(headers, targetUserId)
            break
        case 'restore':
            await restoreAccessLocalUser(headers, targetUserId)
            break
        case 'reset-password':
            await resetAccessLocalUserPassword(headers, targetUserId, command.newPassword)
            break
        case 'revoke-sessions':
            await revokeAccessLocalUserSessions(headers, targetUserId)
            break
    }
}

function assertMutationAllowed(
    actorId: string,
    target: LocalUserPolicySubject,
    activeAdminCount: number,
    action: ProtectedLocalUserAction,
    nextRole?: LocalAccessRole,
): void {
    const violation = evaluateLocalUserMutation(
        actorId,
        target,
        activeAdminCount,
        action,
        nextRole,
    )

    if (violation === 'CANNOT_MANAGE_SELF') {
        throw new LocalUserManagementError(
            violation,
            409,
            'Use the personal account controls for your own account',
        )
    }

    if (violation === 'LAST_ADMIN_REQUIRED') {
        throw new LocalUserManagementError(
            violation,
            409,
            'At least one active administrator must remain',
        )
    }
}

export async function listLocalUsers(headers: Headers): Promise<LocalUserList> {
    const actor = await requireAdministrator(headers)
    const users = await database.read((client) => client.user.findMany({
        orderBy: [
            { createdAt: 'asc' },
            { email: 'asc' },
        ],
        select: {
            id: true,
            name: true,
            email: true,
            username: true,
            role: true,
            banned: true,
            createdAt: true,
            _count: {
                select: { sessions: true },
            },
        },
    }))
    const activeAdminCount = users.filter(isActiveAdmin).length

    return {
        currentUserId: actor.id,
        users: users.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username ?? null,
            role: accessRoles(user.role).includes('admin') ? 'admin' : 'user',
            disabled: user.banned === true,
            createdAt: user.createdAt.toISOString(),
            sessionCount: user._count.sessions,
            isCurrentUser: user.id === actor.id,
            isLastActiveAdmin: isActiveAdmin(user) && activeAdminCount === 1,
        })),
    }
}

export async function createLocalUser(
    request: Request,
    input: unknown,
): Promise<{ userId: string }> {
    return runAuditedMutation(
        'LOCAL_USER_CREATE',
        request,
        undefined,
        async () => {
            const created = await createAccessLocalUser(parseCreateInput(input))
            return {
                value: created,
                targetUserId: created.userId,
            }
        },
    )
}

export async function executeLocalUserCommand(
    request: Request,
    targetUserId: string,
    input: unknown,
): Promise<{ userId: string }> {
    return runAuditedMutation(
        commandAuditEventType(input),
        request,
        targetUserId,
        async (actor) => {
            return userMutationCoordinator.runForUser(targetUserId, async () => {
                const command = parseCommand(input)
                const target = await mutationTarget(targetUserId)
                assertSelfMutationAllowed(actor.id, target, command)

                if (commandReducesActiveAdminSet(target, command)) {
                    await adminReductionCoordinator.runExclusive(async () => {
                        // Authentication and the administrator count are deliberately
                        // refreshed inside the serialized boundary.
                        const currentActor = await requireAdministrator(request.headers)
                        const current = await mutationSubjects(targetUserId)
                        const action = protectedAction(command)
                        if (action === null) {
                            throw new Error('Administrator reduction requires a protected action')
                        }

                        assertMutationAllowed(
                            currentActor.id,
                            current.target,
                            current.activeAdminCount,
                            action,
                            command.action === 'set-role' ? command.role : undefined,
                        )
                        await applyLocalUserCommand(request.headers, targetUserId, command)
                    })
                } else {
                    await applyLocalUserCommand(request.headers, targetUserId, command)
                }

                return {
                    value: { userId: targetUserId },
                    targetUserId,
                }
            })
        },
    )
}
