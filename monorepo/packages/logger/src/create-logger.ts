import {
    LOG_LEVELS,
    type LogLevel,
} from './contracts.js';

import type {
    LoggerFactory,
    LoggerProvider,
    LoggerProviderConfig,
} from './provider.js';

import type {
    CreateLoggerOptions,
    LogFormat,
} from './server-options.js';

import { copyLogContext } from './internal/log-context.js';

function isLogLevel(
    value: string,
): value is LogLevel {
    return (
        LOG_LEVELS as readonly string[]
    ).includes(value);
}

function resolveServiceName(
    service: string,
): string {
    const normalized = service.trim();

    if (normalized.length === 0) {
        throw new Error(
            'Logger service name cannot be empty',
        );
    }

    return normalized;
}

function resolveEnvironment(
    environment: string | undefined,
): string {
    const normalized = (
        environment ??
        process.env.NODE_ENV ??
        'production'
    ).trim();

    if (normalized.length === 0) {
        return 'production';
    }

    return normalized;
}

function resolveLogLevel(
    explicitLevel: LogLevel | undefined,
    environment: string,
): LogLevel {
    if (explicitLevel !== undefined) {
        return explicitLevel;
    }

    const environmentLevel =
        process.env.LOG_LEVEL;

    if (environmentLevel !== undefined) {
        if (!isLogLevel(environmentLevel)) {
            throw new Error(
                `Invalid LOG_LEVEL environment variable: ${environmentLevel}`,
            );
        }

        return environmentLevel;
    }

    if (environment === 'test') {
        return 'silent';
    }

    if (environment === 'development') {
        return 'debug';
    }

    return 'info';
}

function resolveLogFormat(
    explicitFormat: LogFormat | undefined,
    environment: string,
): LogFormat {
    if (explicitFormat !== undefined) {
        return explicitFormat;
    }

    if (
        environment === 'development' &&
        Boolean(process.stdout.isTTY)
    ) {
        return 'pretty';
    }

    return 'json';
}

function resolveProviderConfig(
    options: CreateLoggerOptions,
): LoggerProviderConfig {
    const environment = resolveEnvironment(
        options.environment,
    );

    const context = copyLogContext(
        options.context,
    );

    const sensitivePaths = Object.freeze([
        ...(options.sensitivePaths ?? []),
    ]);

    const base = {
        service: resolveServiceName(
            options.service,
        ),

        environment,

        level: resolveLogLevel(
            options.level,
            environment,
        ),

        format: resolveLogFormat(
            options.format,
            environment,
        ),

        enabled: options.enabled ?? true,

        context,

        sensitivePaths,
    };

    if (options.version === undefined) {
        return base;
    }

    return {
        ...base,
        version: options.version,
    };
}

/**
 * 将一个具体 LoggerProvider 绑定成应用可使用的工厂。
 *
 * 这里没有任何具体 Logger 实现的 import。
 */
export function createLoggerFactory(
    provider: LoggerProvider,
): LoggerFactory {
    return (
        options: CreateLoggerOptions,
    ) => {
        const config =
            resolveProviderConfig(options);

        return provider.create(config);
    };
}
