import type { AccessContext } from '@monorepo/access-server'

export default defineEventHandler((event) => {
    const access = event.context.access as AccessContext | undefined

    if (!access?.authenticated) {
        return {
            authenticated: false as const,
        }
    }

    return {
        authenticated: true as const,
        user: {
            id: access.user.id,
            name: access.user.name,
            email: access.user.email,
            username: access.user.username,
            roles: access.user.roles,
        },
    }
})
