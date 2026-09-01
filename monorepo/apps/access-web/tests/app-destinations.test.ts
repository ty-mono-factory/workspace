import assert from 'node:assert/strict'
import test from 'node:test'
import { requestedAppKey } from '../utils/app-destinations.js'

test('accepts only the configured application key', () => {
    assert.equal(requestedAppKey('ty-demo-app'), 'ty-demo-app')
    assert.equal(requestedAppKey(['ty-demo-app']), 'ty-demo-app')
})

test('rejects URLs and unknown application keys', () => {
    assert.equal(requestedAppKey('https://attacker.example'), null)
    assert.equal(requestedAppKey('../account'), null)
    assert.equal(requestedAppKey('unknown'), null)
})
