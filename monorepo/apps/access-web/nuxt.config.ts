import { defineNuxtConfig } from 'nuxt/config'

const accessWebPort = Number.parseInt(process.env.ACCESS_WEB_PORT ?? '10001', 10)

export default defineNuxtConfig({
    compatibilityDate: '2025-01-15',
    devtools: { enabled: false },
    devServer: { port: accessWebPort },
    modules: ['@nuxt/ui'],
    nitro: {
        plugins: ['~/server/plugins/access-lifecycle.ts'],
    },
    runtimeConfig: {
        public: {
            tyDemoUrl: process.env.TY_DEMO_URL ?? 'http://localhost:10002/',
        },
    },
})
