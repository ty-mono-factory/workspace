const { join } = require('node:path')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl || databaseUrl.trim() === '') {
    throw new Error('DATABASE_URL must be injected before starting the migrator')
}

module.exports = {
    schema: join(__dirname, 'schema.prisma'),
    migrations: { path: join(__dirname, 'migrations') },
    datasource: { url: databaseUrl },
}
