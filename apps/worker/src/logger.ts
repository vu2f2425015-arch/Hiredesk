import pino from 'pino';
import { workerConfig } from './config.js';

export const logger = pino({
  level: workerConfig.LOG_LEVEL,
  redact: {
    paths: ['*.password', '*.pass', '*.secret', '*.token', '*.emailBody', '*.extractedText'],
    censor: '[REDACTED]',
  },
  transport:
    workerConfig.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
