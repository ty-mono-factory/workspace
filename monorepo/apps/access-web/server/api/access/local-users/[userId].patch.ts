import { executeLocalUserCommand } from '@monorepo/access-server'
import {
    accessManagementRequest,
    throwLocalUserManagementError,
} from '../../../utils/local-user-management.js'

export default defineEventHandler(async (event) => {
    const userId = getRouterParam(event, 'userId')
    if (!userId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'User id is required',
        })
    }

    try {
        const input: unknown = await readBody(event)
        return await executeLocalUserCommand(
            accessManagementRequest(event),
            userId,
            input,
        )
    } catch (error) {
        throwLocalUserManagementError(error)
    }
})
