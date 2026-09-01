import { config } from 'dotenv'
import { defineConfig } from 'prisma/config'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../../.env') })

const databaseUrl = process.env.DATABASE_URL ?? 'file:///workspace/data/monorepo/database/dev.db'
export default defineConfig({
    schema: './prisma/schema.prisma',
    datasource: {
        url: databaseUrl,
    },
})
