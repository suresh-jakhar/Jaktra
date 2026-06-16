import 'dotenv/config';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { createDatabaseClient } from './db/index.js';
import { logger } from './shared/logger.js';

const db = createDatabaseClient({ connectionString: config.DATABASE_URL });

const app = createApp({
  corsOrigins: config.CORS_ORIGINS,
  db,
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  aimlServiceUrl: config.AI_ML_SERVICE_URL,
  aimlServiceKey: config.AI_ML_SERVICE_KEY,
  sendgridApiKey: config.SENDGRID_API_KEY,
  razorpayWebhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
  sendgridWebhookPublicKey: config.SENDGRID_WEBHOOK_PUBLIC_KEY,
});

const server = app.listen(config.PORT, () => {
  logger.info(`CreditOps backend running on port ${config.PORT} [${config.NODE_ENV}]`);
  logger.info(`Health → http://localhost:${config.PORT}/api/health`);
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Starting graceful shutdown…`);

  server.close(() => {
    logger.info('No new connections. Waiting for in-flight requests…');
  });

  const agentService = app.locals.agentService;
  const checkInterval = setInterval(() => {
    if (!agentService || !agentService.hasActiveRuns()) {
      clearInterval(checkInterval);
      logger.info('All agent runs complete. Shutting down.');
      process.exit(0);
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(checkInterval);
    logger.error('Forced shutdown after 30s timeout.');
    process.exit(1);
  }, 30_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
