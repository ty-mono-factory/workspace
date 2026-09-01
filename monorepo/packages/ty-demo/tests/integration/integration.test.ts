import assert from 'node:assert/strict'
import test from 'node:test'
import { tyDemo } from '../../src/index.js'

test('calls the native Node-API binding and C implementation with the default name', () => {
    assert.equal(tyDemo.getWholeSentence(), 'My name is chenty')
})

test('calls the native Node-API binding and C implementation with a custom name', () => {
    assert.equal(tyDemo.getWholeSentence('Alice'), 'My name is Alice')
})

test('passes an empty name through the native C implementation', () => {
    assert.equal(tyDemo.getWholeSentence(''), 'My name is ')
})
