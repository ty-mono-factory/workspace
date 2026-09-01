import { createAuthClient } from 'better-auth/vue'
import { adminClient, usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
    basePath: '/api/access/auth',
    plugins: [
        usernameClient(),
        // Retains the admin-managed user fields on the inferred session type.
        // Raw admin HTTP mutations are blocked by access-server; the UI uses
        // /api/access/local-users instead.
        adminClient(),
    ],
})
