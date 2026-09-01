import type {
    LogContext,
    LogLevel,
} from './contracts.js';

export type LogFormat =
    | 'json'
    | 'pretty';

/**
 * 应用传给 Logger 工厂的原始配置。
 */
export interface CreateLoggerOptions {
    /**
     * 服务名称。
     *
     * 例如：
     * - portal
     * - admin-api
     * - background-worker
     */
    readonly service: string;

    /**
     * 默认读取 NODE_ENV。
     * 未设置时按照 production 处理。
     */
    readonly environment?: string;

    /**
     * 应用版本或构建版本。
     */
    readonly version?: string;

    /**
     * 显式日志级别。
     *
     * 优先级：
     * 1. options.level
     * 2. LOG_LEVEL
     * 3. 环境默认值
     */
    readonly level?: LogLevel;

    /**
     * 输出格式。
     *
     * 默认：
     * - development + TTY: pretty
     * - 其他情况: json
     */
    readonly format?: LogFormat;

    /**
     * 是否启用日志。
     */
    readonly enabled?: boolean;

    /**
     * 根 Logger 携带的固定上下文。
     */
    readonly context?: LogContext;

    /**
     * 需要额外脱敏的字段路径。
     *
     * 路径相对于 context 和 attributes。
     *
     * 例如：
     * - body.creditCard
     * - user.identityNumber
     *
     * 只能使用应用自身控制的静态配置，
     * 不能根据客户端输入动态生成。
     */
    readonly sensitivePaths?: readonly string[];
}
