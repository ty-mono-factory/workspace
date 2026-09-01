export type AdminReductionCoordinationScope = 'process' | 'cluster'

/**
 * Serializes commands that can shrink the set of active administrators.
 *
 * A cluster-scoped implementation must use a shared, durable coordinator.
 * The current implementation deliberately advertises process scope only.
 */
export interface AdminReductionCoordinator {
    readonly scope: AdminReductionCoordinationScope

    runExclusive<T>(operation: () => Promise<T>): Promise<T>
}

export function createProcessAdminReductionCoordinator(): AdminReductionCoordinator {
    let tail = Promise.resolve()

    return {
        scope: 'process',
        async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
            const previous = tail
            let release = (): void => undefined
            const current = new Promise<void>((resolve) => {
                release = resolve
            })
            tail = current

            await previous
            try {
                return await operation()
            } finally {
                release()
            }
        },
    }
}
