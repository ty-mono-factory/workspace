export default defineNitroPlugin((nitroApp) => {
    if (useRuntimeConfig().accessMode !== 'authenticated') {
        return
    }

    nitroApp.hooks.hook('close', async () => {
        const { closeAccessSubsystem } = await import('@monorepo/access-server')
        await closeAccessSubsystem()
    })
})
