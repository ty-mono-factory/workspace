import assert from 'node:assert/strict'
import test from 'node:test'
import { readAccessServerConfig } from '../src/config.js'

const validEnvironment = {
    BETTER_AUTH_SECRET: 'x'.repeat(32),
}

test('creates a single implementation-neutral access route', () => {
    const config = readAccessServerConfig(validEnvironment)
    assert.equal(config.basePath, '/api/access/auth')
    assert.equal(config.sessionExpiresInSeconds, 24 * 60 * 60)
    assert.deepEqual(config.trustedOrigins, ['http://localhost:10001'])
})

test('requires a production-sized authentication secret', () => {
    assert.throws(
        () => readAccessServerConfig({ BETTER_AUTH_SECRET: 'short' }),
        /at least 32 characters/,
    )
})

test('rejects an inverted password length range', () => {
    assert.throws(
        () => readAccessServerConfig({
            ...validEnvironment,
            ACCESS_PASSWORD_MIN_LENGTH: '129',
            ACCESS_PASSWORD_MAX_LENGTH: '128',
        }),
        /cannot exceed/,
    )
})

test('keeps the public auth route stable when configuring the host', () => {
    assert.throws(
        () => readAccessServerConfig({
            ...validEnvironment,
            BETTER_AUTH_URL: 'https://example.com/another/auth/path',
        }),
        /without a path/,
    )
})
