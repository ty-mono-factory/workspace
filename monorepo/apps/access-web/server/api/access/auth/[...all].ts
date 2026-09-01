import { handleAccessRequest } from '@monorepo/access-server'

export default defineEventHandler((event) => {
    return handleAccessRequest(toWebRequest(event))
})
