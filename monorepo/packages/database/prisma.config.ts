import { defineConfig } from 'prisma/config'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required; inject it before starting the process')
}

export default defineConfig({
    schema: join(__dirname, 'prisma/schema.prisma'),
    migrations: { path: join(__dirname, 'prisma/migrations') },
    datasource: { url: databaseUrl },
})