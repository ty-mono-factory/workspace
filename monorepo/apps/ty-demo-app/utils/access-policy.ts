export type ApplicationAccessMode = 'public' | 'authenticated'
export type UnauthenticatedAccessAction = 'redirect-to-login' | 'reject'

const PROTECTED_PATHS = new Set([
    '/',
    '/api/access/account',
    '/api/ty-demo',
])

export function requiresAccessContext(
    mode: ApplicationAccessMode,
    path: string,
): boolean {
    return mode === 'authenticated' && PROTECTED_PATHS.has(path)
}

export function unauthenticatedAccessAction(
    path: string,
): UnauthenticatedAccessAction {
    return path.startsWith('/api/') ? 'reject' : 'redirect-to-login'
}
