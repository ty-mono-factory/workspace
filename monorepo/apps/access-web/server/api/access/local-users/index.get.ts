import { listLocalUsers } from '@monorepo/access-server'
import {
    accessManagementRequest,
    throwLocalUserManagementError,
} from '../../../utils/local-user-management.js'

export default defineEventHandler(async (event) => {
    try {
        const request = accessManagementRequest(event)
        return await listLocalUsers(request.headers)
    } catch (error) {
        throwLocalUserManagementError(error)
    }
})
