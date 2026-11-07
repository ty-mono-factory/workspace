import { accessSync, constants, existsSync } from 'node:fs'
import { dirname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const action = args[0] ?? 'deploy'
if (args.length > 1 || !['deploy', 'status'].includes(action)) {
    console.error('Usage: dbmigrator [deploy|status]')
    process.exit(2)
}

try {
    // This release uses provider=sqlite. Remote libSQL needs its own migration path.
    const url = process.env.DATABASE_URL
    if (!url || !/^file:\//.test(url)) {
        throw new Error('DATABASE_URL must be an absolute file: URL for the shared SQLite volume')
    }
    const databasePath = fileURLToPath(new URL(url))
    if (!isAbsolute(databasePath)) throw new Error('Database path must be absolute')
    accessSync(dirname(databasePath), constants.W_OK | constants.X_OK)
    if (existsSync(databasePath)) accessSync(databasePath, constants.W_OK)
} catch {
    console.error('Invalid DATABASE_URL or inaccessible SQLite volume; mount persistent storage and match the application UID/GID')
    process.exit(2)
}

const child = spawn(process.execPath, [
    '/opt/prisma-cli/node_modules/prisma/build/index.js',
    'migrate', action, '--config', '/migration/prisma.config.cjs',
], { stdio: 'inherit', env: process.env })
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
}
child.on('error', () => {
    console.error('Unable to start the packaged Prisma CLI')
    process.exitCode = 1
})
child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143)
})
