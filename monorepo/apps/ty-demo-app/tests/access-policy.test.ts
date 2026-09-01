import assert from 'node:assert/strict'
import test from 'node:test'
import {
    requiresAccessContext,
    unauthenticatedAccessAction,
} from '../utils/access-policy.js'

test('public mode does not require an access context', () => {
    assert.equal(requiresAccessContext('public', '/'), false)
    assert.equal(requiresAccessContext('public', '/api/access/account'), false)
    assert.equal(requiresAccessContext('public', '/api/ty-demo'), false)
})

test('authenticated mode protects both the page and its business API', () => {
    assert.equal(requiresAccessContext('authenticated', '/'), true)
    assert.equal(requiresAccessContext('authenticated', '/api/access/account'), true)
    assert.equal(requiresAccessContext('authenticated', '/api/ty-demo'), true)
    assert.equal(requiresAccessContext('authenticated', '/_nuxt/app.js'), false)
})

test('anonymous page and API requests have different transport outcomes', () => {
    assert.equal(unauthenticatedAccessAction('/'), 'redirect-to-login')
    assert.equal(unauthenticatedAccessAction('/api/ty-demo'), 'reject')
})
