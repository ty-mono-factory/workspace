export {
    createDatabaseClient,
    type CreateDatabaseClientOptions,
    type DatabaseClient,
} from './client.js'

export {
    createDatabase,
    type CreateDatabaseOptions,
    type Database,
    type DatabaseRead,
    type DatabaseTransactionClient,
    type DatabaseWrite,
    type DatabaseWriteOptions,
} from './database.js'

export {
    assertDatabaseReady,
    closeDatabase,
    database,
    db,
    getDatabase,
    getDatabaseClient,
    getDb,
    readDatabase,
    writeDatabase,
} from './singleton.js'

export * from './generated/client.js'
