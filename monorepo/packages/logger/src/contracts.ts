export const LOG_LEVELS = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type WritableLogLevel = Exclude<
    LogLevel,
    'silent'
>;

export type LogAttributes = Readonly<
    Record<string, unknown>
>;

/**
 * 固定日志上下文只允许稳定、可直接序列化的标量值。
 *
 * 请求对象、用户对象等结构化数据应作为单次日志的 attributes 传入，
 * 避免可变嵌套引用污染后续日志。
 */
export type LogContextValue =
    | string
    | number
    | boolean
    | null;

export type LogContext = Readonly<
    Record<string, LogContextValue>
>;

export interface LoggerContextOptions {
    /** 覆盖新 Logger 的最低日志级别；未设置时继承当前 Logger。 */
    readonly level?: LogLevel;
}

/**
 * 与具体日志实现无关的公共 Logger 接口。
 */
export interface Logger {
    trace(
        message: string,
        attributes?: LogAttributes,
    ): void;

    debug(
        message: string,
        attributes?: LogAttributes,
    ): void;

    info(
        message: string,
        attributes?: LogAttributes,
    ): void;

    warn(
        message: string,
        attributes?: LogAttributes,
    ): void;

    /**
     * 记录预期的业务错误。
     *
     * 例如：
     * - 凭据无效
     * - 权限不足
     * - 资源状态不允许当前操作
     */
    error(
        message: string,
        attributes?: LogAttributes,
    ): void;

    /**
     * 记录捕获到的未知异常。
     *
     * 具体 Provider 负责：
     * - 归一化 unknown
     * - 提取 message 和 stack
     * - 转换成底层 Logger 需要的格式
     */
    exception(
        message: string,
        error: unknown,
        attributes?: LogAttributes,
    ): void;

    /**
     * 记录导致当前进程无法继续运行的事件。
     */
    fatal(
        message: string,
        attributes?: LogAttributes,
    ): void;

    /**
     * 返回携带额外固定上下文的新 Logger。
     *
     * 例如：
     * - requestId
     * - component
     * - operation
     * - jobId
     *
     * 可为特定请求或客户覆盖级别：
     * `logger.withContext({ requestId }, { level: 'debug' })`
     */
    withContext(
        context: LogContext,
        options?: LoggerContextOptions,
    ): Logger;

    isLevelEnabled(
        level: WritableLogLevel,
    ): boolean;
}
