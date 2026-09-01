import {
    bootstrapAdminFromEnvironment,
    closeAccessSubsystem,
} from '@monorepo/access-server'

export default defineNitroPlugin(async (nitroApp) => {
    nitroApp.hooks.hook('close', closeAccessSubsystem)
    const result = await bootstrapAdminFromEnvironment()

    if (result.status === 'created') {
        console.info(`[access] bootstrap administrator created: ${result.userId}`)
    }
})
