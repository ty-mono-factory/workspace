export const TY_DEMO_APP_KEY = 'ty-demo-app'

export function requestedAppKey(value: unknown): typeof TY_DEMO_APP_KEY | null {
    const candidate = Array.isArray(value) ? value[0] : value
    return candidate === TY_DEMO_APP_KEY ? TY_DEMO_APP_KEY : null
}
