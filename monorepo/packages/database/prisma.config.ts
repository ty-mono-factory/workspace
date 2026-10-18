import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../../.env'), quiet: true })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Run: source env.sh')
}

export default defineConfig({
    schema: join(__dirname, 'prisma/schema.prisma'),
    migrations: { path: join(__dirname, 'prisma/migrations') },
    datasource: { url: databaseUrl },
})