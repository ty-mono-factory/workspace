import type {
    LogContext,
    Logger,
    LogLevel,
} from './contracts.js';

import type {
    CreateLoggerOptions,
    LogFormat,
} from './server-options.js';

/**
 * 传给具体 Logger Provider 的完整配置。
 *
 * 该配置已经由通用工厂完成：
 * - 默认值解析
 * - 环境变量读取
 * - 基础校验
 * - 防御性复制
 */
export interface LoggerProviderConfig {
    readonly service: string;

    readonly environment: string;

    readonly version?: string;

    readonly level: LogLevel;

    readonly format: LogFormat;

    readonly enabled: boolean;

    readonly context: LogContext;

    readonly sensitivePaths: readonly string[];
}

/**
 * 具体日志实现必须满足的创建接口。
 *
 * Pino、Winston、Signal 或测试 Provider
 * 都通过这个接口接入。
 */
export interface LoggerProvider {
    create(
        config: LoggerProviderConfig,
    ): Logger;
}

/**
 * 绑定 Provider 后生成的 Logger 工厂。
 */
export type LoggerFactory = (
    options: CreateLoggerOptions,
) => Logger;
