import assert from 'node:assert/strict'
import test from 'node:test'
import {
    evaluateLocalUserMutation,
    isActiveAdmin,
    reducesActiveAdminSet,
} from '../src/local-user-policy.js'

const admin = {
    id: 'admin-1',
    role: 'admin',
    banned: false,
}

test('recognizes only enabled users with the admin role as active administrators', () => {
    assert.equal(isActiveAdmin(admin), true)
    assert.equal(isActiveAdmin({ ...admin, banned: true }), false)
    assert.equal(isActiveAdmin({ ...admin, role: 'user' }), false)
})

test('prevents an administrator from managing their own protected state', () => {
    assert.equal(
        evaluateLocalUserMutation(admin.id, admin, 2, 'disable'),
        'CANNOT_MANAGE_SELF',
    )
    assert.equal(
        evaluateLocalUserMutation(admin.id, admin, 2, 'set-role', 'user'),
        'CANNOT_MANAGE_SELF',
    )
    assert.equal(
        evaluateLocalUserMutation(admin.id, admin, 2, 'reset-password'),
        'CANNOT_MANAGE_SELF',
    )
    assert.equal(
        evaluateLocalUserMutation(admin.id, admin, 2, 'revoke-sessions'),
        'CANNOT_MANAGE_SELF',
    )
})

test('prevents disabling or demoting the last active administrator', () => {
    assert.equal(
        evaluateLocalUserMutation('admin-2', admin, 1, 'disable'),
        'LAST_ADMIN_REQUIRED',
    )
    assert.equal(
        evaluateLocalUserMutation('admin-2', admin, 1, 'set-role', 'user'),
        'LAST_ADMIN_REQUIRED',
    )
})

test('classifies only operations that shrink the active administrator set', () => {
    assert.equal(reducesActiveAdminSet(admin, 'disable'), true)
    assert.equal(reducesActiveAdminSet(admin, 'set-role', 'user'), true)
    assert.equal(reducesActiveAdminSet(admin, 'set-role', 'admin'), false)
    assert.equal(reducesActiveAdminSet(admin, 'reset-password'), false)
    assert.equal(
        reducesActiveAdminSet({ ...admin, role: 'user' }, 'disable'),
        false,
    )
})

test('allows another administrator to be disabled when one will remain', () => {
    assert.equal(
        evaluateLocalUserMutation('admin-2', admin, 2, 'disable'),
        null,
    )
    assert.equal(
        evaluateLocalUserMutation('admin-2', admin, 2, 'set-role', 'admin'),
        null,
    )
})
