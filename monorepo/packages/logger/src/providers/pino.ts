import {
    pino,
    type Logger as PinoLogger,
    type LoggerOptions as PinoLoggerOptions,
} from 'pino';

import type {
    LogAttributes,
    LogContext,
    Logger,
    LoggerContextOptions,
    WritableLogLevel,
} from '../contracts.js';

import { normalizeError } from '../internal/error-normalizer.js';
import { copyLogContext } from '../internal/log-context.js';

import type {
    LoggerProvider,
    LoggerProviderConfig,
} from '../provider.js';

const DEFAULT_SENSITIVE_PATHS = [
    'password',
    'oldPassword',
    'newPassword',
    'passwordConfirmation',
    'token',
    'accessToken',
    'refreshToken',
    'verificationCode',
    'recoveryCode',
    'sessionToken',
    'authorization',
    'cookie',
    'headers.authorization',
    'headers.cookie',
    'request.headers.authorization',
    'request.headers.cookie',
    'body.password',
    'body.oldPassword',
    'body.newPassword',
    'body.token',
    'body.accessToken',
    'body.refreshToken',
    'body.verificationCode',
    'body.recoveryCode',
] as const;

function buildRedactPaths(
    additionalPaths: readonly string[],
): string[] {
    const paths = [
        ...DEFAULT_SENSITIVE_PATHS,
        ...additionalPaths,
    ];

    return paths.flatMap((path) => [
        `context.${path}`,
        `attributes.${path}`,
        `error.${path}`,
    ]);
}

function hasProperties(
    value: LogAttributes,
): boolean {
    return Object.keys(value).length > 0;
}

class PinoLoggerAdapter implements Logger {
    private readonly context: LogContext;

    private readonly hasContext: boolean;

    constructor(
        private readonly inner: PinoLogger,
        context: LogContext,
    ) {
        this.context = copyLogContext(
            context,
        );

        this.hasContext =
            hasProperties(this.context);
    }

    trace(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'trace',
            message,
            attributes,
        );
    }

    debug(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'debug',
            message,
            attributes,
        );
    }

    info(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'info',
            message,
            attributes,
        );
    }

    warn(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'warn',
            message,
            attributes,
        );
    }

    error(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'error',
            message,
            attributes,
        );
    }

    exception(
        message: string,
        error: unknown,
        attributes?: LogAttributes,
    ): void {
        const record =
            this.buildRecord(attributes) ?? {};

        record.error =
            normalizeError(error);

        this.inner.error(
            record,
            message,
        );
    }

    fatal(
        message: string,
        attributes?: LogAttributes,
    ): void {
        this.write(
            'fatal',
            message,
            attributes,
        );
    }

    withContext(
        context: LogContext,
        options?: LoggerContextOptions,
    ): Logger {
        const child = options?.level === undefined
            ? this.inner
            : this.inner.child(
                {},
                { level: options.level },
            );

        return new PinoLoggerAdapter(
            child,
            {
                ...this.context,
                ...context,
            },
        );
    }

    isLevelEnabled(
        level: WritableLogLevel,
    ): boolean {
        return this.inner.isLevelEnabled(
            level,
        );
    }

    private buildRecord(
        attributes?: LogAttributes,
    ): Record<string, unknown> | undefined {
        const hasAttributes =
            attributes !== undefined &&
            hasProperties(attributes);

        if (
            !this.hasContext &&
            !hasAttributes
        ) {
            return undefined;
        }

        const record: Record<
            string,
            unknown
        > = {};

        if (this.hasContext) {
            record.context = this.context;
        }

        if (hasAttributes) {
            record.attributes = attributes;
        }

        return record;
    }

    private write(
        level: WritableLogLevel,
        message: string,
        attributes?: LogAttributes,
    ): void {
        const record =
            this.buildRecord(attributes);

        switch (level) {
            case 'trace':
                if (record === undefined) {
                    this.inner.trace(message);
                } else {
                    this.inner.trace(
                        record,
                        message,
                    );
                }
                return;

            case 'debug':
                if (record === undefined) {
                    this.inner.debug(message);
                } else {
                    this.inner.debug(
                        record,
                        message,
                    );
                }
                return;

            case 'info':
                if (record === undefined) {
                    this.inner.info(message);
                } else {
                    this.inner.info(
                        record,
                        message,
                    );
                }
                return;

            case 'warn':
                if (record === undefined) {
                    this.inner.warn(message);
                } else {
                    this.inner.warn(
                        record,
                        message,
                    );
                }
                return;

            case 'error':
                if (record === undefined) {
                    this.inner.error(message);
                } else {
                    this.inner.error(
                        record,
                        message,
                    );
                }
                return;

            case 'fatal':
                if (record === undefined) {
                    this.inner.fatal(message);
                } else {
                    this.inner.fatal(
                        record,
                        message,
                    );
                }
        }
    }
}

export const pinoLoggerProvider:
    LoggerProvider = {
    create(
        config: LoggerProviderConfig,
    ): Logger {
        const pinoOptions:
            PinoLoggerOptions = {
            level: config.level,

            enabled: config.enabled,

            /**
             * 公共日志结构使用 error。
             * Pino 的错误字段约定不会泄漏到业务层。
             */
            errorKey: 'error',

            serializers: {
                error:
                    pino.stdSerializers.err,
            },

            redact: {
                paths: buildRedactPaths(
                    config.sensitivePaths,
                ),

                censor: '[REDACTED]',
            },
        };

        if (config.format === 'pretty') {
            pinoOptions.transport = {
                target: 'pino-pretty',

                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                    singleLine: false,
                },
            };
        }

        const rootBindings: Record<
            string,
            unknown
        > = {
            service: config.service,
            environment:
                config.environment,
        };

        if (config.version !== undefined) {
            rootBindings.version =
                config.version;
        }

        const inner = pino(
            pinoOptions,
        ).child(rootBindings);

        return new PinoLoggerAdapter(
            inner,
            config.context,
        );
    },
};
