export interface AccessServerConfig {
    basePath: string
    baseUrl: string
    secret: string
    trustedOrigins: string[]
    sessionExpiresInSeconds: number
    password: {
        minLength: number
        maxLength: number
    }
}

const DEFAULT_ACCESS_BASE_PATH = '/api/access/auth'
const DEFAULT_ACCESS_BASE_URL = 'http://localhost:10001'
const DEFAULT_SESSION_TTL_MINUTES = 24 * 60
const DEFAULT_PASSWORD_MIN_LENGTH = 10
const DEFAULT_PASSWORD_MAX_LENGTH = 128

function positiveInteger(
    value: string | undefined,
    fallback: number,
    name: string,
): number {
    if (value === undefined || value.trim() === '') {
        return fallback
    }

    const normalized = value.trim()
    if (!/^\d+$/.test(normalized)) {
        throw new Error(`${name} must be a positive integer`)
    }

    const parsed = Number.parseInt(normalized, 10)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} must be a positive integer`)
    }

    return parsed
}

function baseUrl(value: string | undefined): string {
    const candidate = value?.trim() || DEFAULT_ACCESS_BASE_URL

    try {
        const parsed = new URL(candidate)
        if (
            (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
            || (parsed.pathname !== '/' && parsed.pathname !== '')
            || parsed.search !== ''
            || parsed.hash !== ''
        ) {
            throw new Error()
        }

        return parsed.origin
    } catch {
        throw new Error('BETTER_AUTH_URL must be an HTTP(S) origin without a path')
    }
}

function requiredSecret(value: string | undefined): string {
    const secret = value?.trim() ?? ''
    if (secret.length < 32) {
        throw new Error('BETTER_AUTH_SECRET must contain at least 32 characters')
    }

    return secret
}

function trustedOrigins(value: string | undefined, baseUrl: string): string[] {
    const configured = value
        ?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? []

    return [...new Set([baseUrl, ...configured])]
}

export function readAccessServerConfig(
    env: NodeJS.ProcessEnv = process.env,
): AccessServerConfig {
    const configuredBaseUrl = baseUrl(env.BETTER_AUTH_URL)
    const minLength = positiveInteger(
        env.ACCESS_PASSWORD_MIN_LENGTH,
        DEFAULT_PASSWORD_MIN_LENGTH,
        'ACCESS_PASSWORD_MIN_LENGTH',
    )
    const maxLength = positiveInteger(
        env.ACCESS_PASSWORD_MAX_LENGTH,
        DEFAULT_PASSWORD_MAX_LENGTH,
        'ACCESS_PASSWORD_MAX_LENGTH',
    )

    if (minLength > maxLength) {
        throw new Error('ACCESS_PASSWORD_MIN_LENGTH cannot exceed ACCESS_PASSWORD_MAX_LENGTH')
    }

    return {
        basePath: DEFAULT_ACCESS_BASE_PATH,
        baseUrl: configuredBaseUrl,
        secret: requiredSecret(env.BETTER_AUTH_SECRET),
        trustedOrigins: trustedOrigins(env.ACCESS_TRUSTED_ORIGINS, configuredBaseUrl),
        sessionExpiresInSeconds: positiveInteger(
            env.ACCESS_SESSION_TTL_MINS,
            DEFAULT_SESSION_TTL_MINUTES,
            'ACCESS_SESSION_TTL_MINS',
        ) * 60,
        password: {
            minLength,
            maxLength,
        },
    }
}
