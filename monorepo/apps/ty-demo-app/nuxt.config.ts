import { defineNuxtConfig } from 'nuxt/config'

const accessMode = process.env.TY_DEMO_ACCESS_MODE ?? 'authenticated'
const accessWebUrl = process.env.ACCESS_WEB_URL ?? 'http://localhost:10001'

if (accessMode !== 'public' && accessMode !== 'authenticated') {
    throw new Error('TY_DEMO_ACCESS_MODE must be public or authenticated')
}

export default defineNuxtConfig({
    compatibilityDate: '2025-01-15',
    devtools: { enabled: false },
    devServer: { port: Number.parseInt(process.env.DEMO_PORT ?? '10002', 10) },
    modules: ['@nuxt/ui'],
    runtimeConfig: {
        accessMode,
        public: {
            accessWebUrl,
        },
    },
    vite: {
        server: {
            fs: {
                allow: ['../..', '/workspace/monorepo']
            }
        }
    }
})
