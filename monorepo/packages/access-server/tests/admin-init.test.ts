import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createDatabase } from '@monorepo/database'
import { verifyPassword } from 'better-auth/crypto'
import { initializeAdmin } from '../src/provisioning.js'

const env = { BETTER_AUTH_SECRET: 'test-only-secret-'.repeat(3) }
const input = {
    username: 'operator', email: 'operator@example.com', displayName: 'Operator',
    password: 'test-only-strong-password-29',
}
async function fixture(t: import('node:test').TestContext) {
    const dir = await mkdtemp(join(tmpdir(), 'admin-init-test-'))
    const databaseUrl = `file:${join(dir, 'test.db')}`
    const db = createDatabase({ databaseUrl })
    t.after(async () => { await db.close(); await rm(dir, { recursive: true, force: true }) })
    // Apply the consolidated initial migration to a disposable database.
    for (const path of [
        '../../database/prisma/migrations/20261018061521_init/migration.sql',
    ]) {
        const sql = await readFile(new URL(path, import.meta.url), 'utf8')
        for (const statement of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
            await db.client.$executeRawUnsafe(statement)
        }
    }
    return { db, databaseUrl }
}

test('creates compatible credentials once; deleting user does not reopen initialization', async (t) => {
    const { db } = await fixture(t)
    const result = await initializeAdmin(db, input, env)
    const account = await db.client.account.findFirstOrThrow({ where: { userId: result.userId } })
    assert.equal(account.accountId, result.userId)
    assert.equal(account.providerId, 'credential')
    assert.ok(await verifyPassword({ hash: account.password!, password: input.password }))
    await assert.rejects(initializeAdmin(db, { ...input, username: 'another' }, env), /already complete/)
    await db.client.user.delete({ where: { id: result.userId } })
    await assert.rejects(initializeAdmin(db, input, env), /already complete/)
})

test('audit failure rolls back claim, user and credential; retry succeeds', async (t) => {
    const { db } = await fixture(t)
    await db.client.$executeRawUnsafe(`CREATE TRIGGER fail_audit BEFORE INSERT ON auth_audit BEGIN SELECT RAISE(ABORT, 'test failure'); END`)
    await assert.rejects(initializeAdmin(db, input, env))
    assert.equal(await db.client.user.count(), 0)
    assert.equal(await db.client.account.count(), 0)
    const rows = await db.client.$queryRawUnsafe<unknown[]>('SELECT * FROM access_initialization')
    assert.equal(rows.length, 0)
    await db.client.$executeRawUnsafe('DROP TRIGGER fail_audit')
    await initializeAdmin(db, input, env)
})

test('independent clients cannot initialize two administrators concurrently', async (t) => {
    const { db, databaseUrl } = await fixture(t)
    const second = createDatabase({ databaseUrl })
    t.after(() => second.close())
    const results = await Promise.allSettled([
        initializeAdmin(db, input, env),
        initializeAdmin(second, { ...input, username: 'other', email: 'other@example.com' }, env),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(await db.client.user.count(), 1)
    assert.equal(await db.client.account.count(), 1)
})

test('existing ordinary user prevents initialization without privilege escalation', async (t) => {
    const { db } = await fixture(t)
    await db.client.user.create({ data: { id: 'existing', name: 'Existing', email: 'existing@example.com', role: 'user' } })
    await assert.rejects(initializeAdmin(db, input, env), /Existing users/)
    assert.equal(await db.client.user.count(), 1)
    assert.equal((await db.client.user.findUniqueOrThrow({ where: { id: 'existing' } })).role, 'user')
})

test('initial migration leaves bootstrap unclaimed and rejects other initialization keys', async (t) => {
    const { db } = await fixture(t)
    const rows = await db.client.$queryRawUnsafe<unknown[]>('SELECT * FROM access_initialization')
    assert.equal(rows.length, 0)
    await assert.rejects(db.client.$executeRawUnsafe(
        `INSERT INTO access_initialization (key) VALUES ('another-admin')`,
    ))
    assert.equal(await db.client.user.count(), 0)
})
