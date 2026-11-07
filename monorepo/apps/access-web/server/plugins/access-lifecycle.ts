import { closeAccessSubsystem } from '@monorepo/access-server'

export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('close', closeAccessSubsystem)
})
