import { closeDatabase } from '@monorepo/database'

/** Releases resources owned by the Access Subsystem host process. */
export function closeAccessSubsystem(): Promise<void> {
    return closeDatabase()
}
