/**
 * 将 catch 中的 unknown 转换成可安全记录的 Error。
 *
 * 不把任意对象自动挂到 Error.cause，
 * 避免意外记录请求 body、token 或用户对象。
 */
export function normalizeError(
    value: unknown,
): Error {
    if (value instanceof Error) {
        return copySafeErrorFields(value);
    }

    if (typeof value === 'string') {
        return new Error(value);
    }

    if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        typeof value === 'bigint'
    ) {
        return new Error(
            `Non-Error value was thrown: ${String(value)}`,
        );
    }

    return new Error(
        'A non-Error value was thrown',
    );
}

type ErrorWithCode = Error & {
    code?: string | number;
};

/**
 * Error 可以携带任意可枚举属性，Pino 的 error serializer 会记录这些属性。
 * 这里创建一个新的 Error，只复制允许输出的诊断字段，避免 token、请求对象、
 * cause 等附加数据绕过常规 attributes/context 脱敏。
 */
function copySafeErrorFields(
    source: Error,
): ErrorWithCode {
    const error = new Error(
        readStringProperty(source, 'message') ??
        'An error was thrown',
    ) as ErrorWithCode;

    error.name =
        readStringProperty(source, 'name') ??
        'Error';

    const stack = readStringProperty(
        source,
        'stack',
    );

    if (stack !== undefined) {
        error.stack = stack;
    }

    const code = readErrorCode(source);

    if (code !== undefined) {
        error.code = code;
    }

    return error;
}

function readStringProperty(
    error: Error,
    property: 'message' | 'name' | 'stack',
): string | undefined {
    try {
        const value = error[property];
        return typeof value === 'string'
            ? value
            : undefined;
    } catch {
        return undefined;
    }
}

function readErrorCode(
    error: Error,
): string | number | undefined {
    try {
        const code = (
            error as Error & { code?: unknown }
        ).code;

        if (
            typeof code === 'string' ||
            (typeof code === 'number' &&
                Number.isFinite(code))
        ) {
            return code;
        }
    } catch {
        // Error 的自定义 getter 可能抛异常；日志路径不能因此失败。
    }

    return undefined;
}
