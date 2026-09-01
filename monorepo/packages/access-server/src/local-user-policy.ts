export type LocalAccessRole = 'user' | 'admin'

export interface LocalUserPolicySubject {
    id: string
    role: string | null
    banned: boolean | null
}

export type ProtectedLocalUserAction =
    | 'disable'
    | 'reset-password'
    | 'revoke-sessions'
    | 'set-role'

export type LocalUserPolicyViolation =
    | 'CANNOT_MANAGE_SELF'
    | 'LAST_ADMIN_REQUIRED'

export function accessRoles(value: string | null | undefined): string[] {
    return value
        ?.split(',')
        .map((role) => role.trim())
        .filter(Boolean) ?? []
}

export function isActiveAdmin(user: LocalUserPolicySubject): boolean {
    return user.banned !== true && accessRoles(user.role).includes('admin')
}

export function reducesActiveAdminSet(
    target: LocalUserPolicySubject,
    action: ProtectedLocalUserAction,
    nextRole?: LocalAccessRole,
): boolean {
    return isActiveAdmin(target) && (
        action === 'disable'
        || (action === 'set-role' && nextRole !== 'admin')
    )
}

export function evaluateLocalUserMutation(
    actorId: string,
    target: LocalUserPolicySubject,
    activeAdminCount: number,
    action: ProtectedLocalUserAction,
    nextRole?: LocalAccessRole,
): LocalUserPolicyViolation | null {
    if (actorId === target.id) {
        return 'CANNOT_MANAGE_SELF'
    }

    if (reducesActiveAdminSet(target, action, nextRole) && activeAdminCount <= 1) {
        return 'LAST_ADMIN_REQUIRED'
    }

    return null
}
