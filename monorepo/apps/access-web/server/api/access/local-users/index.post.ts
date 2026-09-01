import { createLocalUser } from '@monorepo/access-server'
import {
    accessManagementRequest,
    throwLocalUserManagementError,
} from '../../../utils/local-user-management.js'

export default defineEventHandler(async (event) => {
    try {
        const input: unknown = await readBody(event)
        return await createLocalUser(accessManagementRequest(event), input)
    } catch (error) {
        throwLocalUserManagementError(error)
    }
})
