/**
 * Orders commands for the same user without serializing commands for
 * different users. This prevents a role transition racing a disable command
 * for the same target while preserving ordinary-user concurrency.
 */
export interface UserMutationCoordinator {
    runForUser<T>(userId: string, operation: () => Promise<T>): Promise<T>
}

export function createProcessUserMutationCoordinator(): UserMutationCoordinator {
    const tails = new Map<string, Promise<void>>()

    return {
        async runForUser<T>(
            userId: string,
            operation: () => Promise<T>,
        ): Promise<T> {
            const previous = tails.get(userId) ?? Promise.resolve()
            let release = (): void => undefined
            const current = new Promise<void>((resolve) => {
                release = resolve
            })
            tails.set(userId, current)

            await previous
            try {
                return await operation()
            } finally {
                release()
                if (tails.get(userId) === current) {
                    tails.delete(userId)
                }
            }
        },
    }
}
