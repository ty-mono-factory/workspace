import type {
    LogContext,
    LogContextValue,
} from '../contracts.js';

function isLogContextValue(
    value: unknown,
): value is LogContextValue {
    if (value === null) {
        return true;
    }

    if (
        typeof value === 'string' ||
        typeof value === 'boolean'
    ) {
        return true;
    }

    return (
        typeof value === 'number' &&
        Number.isFinite(value)
    );
}

/**
 * 对固定上下文做运行时校验和防御性复制。
 *
 * TypeScript 类型无法约束 JavaScript 调用方，因此 Provider 边界仍需校验。
 */
export function copyLogContext(
    context: LogContext | undefined,
): LogContext {
    if (context !== undefined) {
        const prototype = typeof context === 'object' && context !== null
            ? Object.getPrototypeOf(context) as unknown
            : undefined;

        if (
            context === null ||
            typeof context !== 'object' ||
            Array.isArray(context) ||
            (
                prototype !== Object.prototype &&
                prototype !== null
            )
        ) {
            throw new TypeError(
                'Logger context must be a plain object',
            );
        }
    }

    const copy: Record<
        string,
        LogContextValue
    > = Object.create(null) as Record<
        string,
        LogContextValue
    >;

    for (const [key, value] of Object.entries(context ?? {})) {
        if (!isLogContextValue(value)) {
            throw new TypeError(
                `Logger context value for "${key}" must be a finite number, string, boolean, or null`,
            );
        }

        copy[key] = value;
    }

    return Object.freeze(copy);
}
