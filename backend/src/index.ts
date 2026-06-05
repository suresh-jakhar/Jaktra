import 'dotenv/config';
import { config } from './config.js';
import { createApp } from './app.js';
import { createDatabaseClient } from './db/index.js';
import { logger } from './utils/logger.js';

const db = createDatabaseClient({ connectionString: config.DATABASE_URL });

const app = createApp({
  corsOrigins: config.CORS_ORIGINS,
  db,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  aimlServiceUrl: config.AI_ML_SERVICE_URL,
});

const server = app.listen(config.PORT, () => {
  logger.info(`CreditOps backend running on port ${config.PORT} [${config.NODE_ENV}]`);
  logger.info(`Health → http://localhost:${config.PORT}/api/health`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down…`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
