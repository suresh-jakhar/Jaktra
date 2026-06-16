import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

export const loggerStorage = new AsyncLocalStorage<{ requestId?: string }>();

const pinoLogger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: process.env['NODE_ENV'] === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
  base: {
    service: 'creditops-backend',
    environment: process.env['NODE_ENV'],
  },
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  }
});

function getMetadata(obj?: any): any {
  const store = loggerStorage.getStore();
  const requestId = store?.requestId;
  
  if (!requestId) return obj || {};
  if (!obj) return { requestId };
  return { requestId, ...obj };
}

export const logger = {
  info: (arg1: any, ...args: any[]): void => {
    if (typeof arg1 === 'string') {
      pinoLogger.info(getMetadata(), arg1, ...args);
    } else {
      pinoLogger.info(getMetadata(arg1), ...args);
    }
  },
  warn: (arg1: any, ...args: any[]): void => {
    if (typeof arg1 === 'string') {
      pinoLogger.warn(getMetadata(), arg1, ...args);
    } else {
      pinoLogger.warn(getMetadata(arg1), ...args);
    }
  },
  error: (arg1: any, ...args: any[]): void => {
    if (typeof arg1 === 'string') {
      const errorObj = args[0];
      if (errorObj instanceof Error) {
        pinoLogger.error(getMetadata({ err: errorObj }), arg1, ...args.slice(1));
      } else if (errorObj && typeof errorObj === 'object') {
        pinoLogger.error(getMetadata(errorObj), arg1, ...args.slice(1));
      } else {
        pinoLogger.error(getMetadata(), arg1, ...args);
      }
    } else {
      pinoLogger.error(getMetadata(arg1), ...args);
    }
  },
  debug: (arg1: any, ...args: any[]): void => {
    if (typeof arg1 === 'string') {
      pinoLogger.debug(getMetadata(), arg1, ...args);
    } else {
      pinoLogger.debug(getMetadata(arg1), ...args);
    }
  },
  child: (bindings: any) => pinoLogger.child(bindings),
};
