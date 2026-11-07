import { constants } from 'node:fs'
import { open } from 'node:fs/promises'
import { createDatabase } from '@monorepo/database'
import { initializeAdmin } from '../../../packages/access-server/src/provisioning.js'

const usage = 'admin-init --username <name> --email <email> --display-name <name> --password-file <path>'
const args = process.argv.slice(2)
if (args.length === 1 && args[0] === '--help') {
    console.info(usage)
} else {
    let db: ReturnType<typeof createDatabase> | undefined
    try {
        const values = new Map<string, string>()
        const allowed = ['--username', '--email', '--display-name', '--password-file']
        for (let i = 0; i < args.length; i += 2) {
            const key = args[i]!
            const value = args[i + 1]
            if (!allowed.includes(key) || !value || value.startsWith('--') || values.has(key)) {
                throw new Error(usage)
            }
            values.set(key, value)
        }
        if (allowed.some((key) => !values.has(key))) throw new Error(usage)
        // No symlinks, special files, or passwords readable by group/other users.
        const file = await open(values.get('--password-file')!, constants.O_RDONLY | constants.O_NOFOLLOW)
        let password: string
        try {
            const stat = await file.stat()
            if (!stat.isFile() || stat.size > 4096 || (stat.mode & 0o077) !== 0) {
                throw new Error('Password file must be a regular file <=4096 bytes with mode 0400 or 0600')
            }
            password = (await file.readFile('utf8')).replace(/\r?\n$/, '')
        } finally {
            await file.close()
        }
        db = createDatabase()
        const result = await initializeAdmin(db, {
            username: values.get('--username')!, email: values.get('--email')!,
            displayName: values.get('--display-name')!, password,
        })
        console.info(`Administrator initialized: ${result.userId}`)
    } catch {
        // Avoid exposing driver diagnostics, credentials or secret file contents.
        console.error('Admin initialization failed: check arguments, secret file permissions, migrations and initialization state. No reset was performed.')
        process.exitCode = 1
    } finally {
        await db?.close()
    }
}
