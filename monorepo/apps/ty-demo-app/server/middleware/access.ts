import {
    requiresAccessContext,
    unauthenticatedAccessAction,
} from '../../utils/access-policy.js'

export default defineEventHandler(async (event) => {
    const path = getRequestURL(event).pathname
    const config = useRuntimeConfig(event)
    const accessMode = config.accessMode === 'public' ? 'public' : 'authenticated'
    if (!requiresAccessContext(accessMode, path)) {
        return
    }

    const { resolveAccessContext } = await import('@monorepo/access-server')
    const requestHeaders = new Headers()
    for (const [name, value] of Object.entries(getHeaders(event))) {
        if (value !== undefined) {
            requestHeaders.set(name, value)
        }
    }

    const context = await resolveAccessContext(requestHeaders)
    if (context.authenticated) {
        event.context.access = context
        return
    }

    if (unauthenticatedAccessAction(path) === 'reject') {
        throw createError({
            statusCode: 401,
            statusMessage: 'Authentication required',
        })
    }

    const loginUrl = new URL('/login', config.public.accessWebUrl)
    loginUrl.searchParams.set('app', 'ty-demo-app')
    return sendRedirect(event, loginUrl.toString(), 302)
})
