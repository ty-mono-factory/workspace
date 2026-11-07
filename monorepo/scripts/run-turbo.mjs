import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
function version(command, args = ['--version']) {
    const result = spawnSync(command, args, { encoding: 'utf8' })
    return { command, status: result.status, stdout: result.stdout, stderr: result.stderr }
}
// Scope this fingerprint to build:addon, rather than invalidating every task.
// CC/CXX/PYTHON must be executable names or paths, not shell command strings.
const fingerprint = {
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    modules: process.versions.modules,
    napi: process.versions.napi,
    os: readFileSync('/etc/os-release', 'utf8'),
    cc: version(process.env.CC || 'cc'),
    cxx: version(process.env.CXX || 'c++'),
    ar: version(process.env.AR || 'ar'),
    python: version(process.env.PYTHON || process.env.npm_config_python || 'python3'),
    libc: version('ldd'),
}
const toolchain = createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex')
let rootEnv = 'missing'
try {
    rootEnv = createHash('sha256').update(readFileSync(new URL('../.env', import.meta.url))).digest('hex')
} catch (error) {
    if (error.code !== 'ENOENT') throw error
}
const result = spawnSync('turbo', process.argv.slice(2), {
    cwd: root,
    env: { ...process.env, TURBO_NATIVE_TOOLCHAIN: toolchain, TURBO_ROOT_ENV: rootEnv },
    stdio: 'inherit',
})
if (result.error) {
    console.error(result.error.message)
}
process.exit(result.status ?? 1)
