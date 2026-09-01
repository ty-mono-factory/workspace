import assert from 'node:assert/strict'
import test from 'node:test'
import { createProcessAdminReductionCoordinator } from '../src/admin-reduction-coordinator.js'
import { createProcessUserMutationCoordinator } from '../src/user-mutation-coordinator.js'

function deferred(): {
    promise: Promise<void>
    resolve: () => void
} {
    let resolve = (): void => undefined
    const promise = new Promise<void>((complete) => {
        resolve = complete
    })
    return { promise, resolve }
}

test('serializes administrator reductions inside the declared process scope', async () => {
    const coordinator = createProcessAdminReductionCoordinator()
    const firstStarted = deferred()
    const releaseFirst = deferred()
    const events: string[] = []

    const first = coordinator.runExclusive(async () => {
        events.push('first:start')
        firstStarted.resolve()
        await releaseFirst.promise
        events.push('first:end')
    })
    await firstStarted.promise

    const second = coordinator.runExclusive(async () => {
        events.push('second:start')
        events.push('second:end')
    })
    await Promise.resolve()

    assert.equal(coordinator.scope, 'process')
    assert.deepEqual(events, ['first:start'])

    releaseFirst.resolve()
    await Promise.all([first, second])
    assert.deepEqual(events, [
        'first:start',
        'first:end',
        'second:start',
        'second:end',
    ])
})

test('prevents two administrators from removing each other', async () => {
    const coordinator = createProcessAdminReductionCoordinator()
    const activeAdministrators = new Set(['admin-a', 'admin-b'])

    async function removeAdministrator(actorId: string, targetId: string): Promise<void> {
        await coordinator.runExclusive(async () => {
            if (!activeAdministrators.has(actorId)) {
                throw new Error('Administrator access is required')
            }
            if (activeAdministrators.size <= 1) {
                throw new Error('At least one active administrator must remain')
            }
            activeAdministrators.delete(targetId)
        })
    }

    const results = await Promise.allSettled([
        removeAdministrator('admin-a', 'admin-b'),
        removeAdministrator('admin-b', 'admin-a'),
    ])

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
    assert.equal(activeAdministrators.size, 1)
})

test('serializes the same user while allowing different users to proceed', async () => {
    const coordinator = createProcessUserMutationCoordinator()
    const firstStarted = deferred()
    const releaseFirst = deferred()
    const events: string[] = []

    const first = coordinator.runForUser('user-a', async () => {
        events.push('a:first:start')
        firstStarted.resolve()
        await releaseFirst.promise
        events.push('a:first:end')
    })
    await firstStarted.promise

    const sameUser = coordinator.runForUser('user-a', async () => {
        events.push('a:second')
    })
    const differentUser = coordinator.runForUser('user-b', async () => {
        events.push('b:first')
    })
    await differentUser

    assert.deepEqual(events, ['a:first:start', 'b:first'])

    releaseFirst.resolve()
    await Promise.all([first, sameUser])
    assert.deepEqual(events, [
        'a:first:start',
        'b:first',
        'a:first:end',
        'a:second',
    ])
})
