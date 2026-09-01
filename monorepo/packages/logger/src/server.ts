import {
    createLoggerFactory,
} from './create-logger.js';

import {
    pinoLoggerProvider,
} from './providers/pino.js';

/**
 * 默认服务端 Logger。
 *
 * 这是唯一负责选择默认 Provider 的组合根。
 */
export const createLogger =
    createLoggerFactory(
        pinoLoggerProvider,
    );

export type {
    CreateLoggerOptions,
    LogFormat,
} from './server-options.js';
