/**
 * logger.ts
 *
 * Single Responsibility: produce structured, prefixed console output.
 * Pure functions — no side effects beyond writing to stdout/stderr.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (message: string): void => {
    console.log(formatMessage('info', message));
  },
  warn: (message: string): void => {
    console.warn(formatMessage('warn', message));
  },
  error: (message: string, error?: unknown): void => {
    const detail =
      error instanceof Error ? ` — ${error.message}` : '';
    console.error(formatMessage('error', `${message}${detail}`));
  },
  debug: (message: string): void => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.debug(formatMessage('debug', message));
    }
  },
} as const;
