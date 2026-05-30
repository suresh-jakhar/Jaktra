/**
 * index.ts — Server entry point
 *
 * Single Responsibility: start the HTTP server and handle graceful shutdown.
 *   All application composition happens in app.ts.
 *   All environment parsing will move to config.ts in A3.
 *
 * For A1, we read the minimum env vars needed to start the server
 * (PORT, NODE_ENV, CORS_ORIGINS). Full validated config is A3's scope.
 */

import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

// ─── Minimal env reading (validated config is Phase A3) ─────────────────────
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const NODE_ENV = process.env['NODE_ENV'] ?? 'development';
const CORS_ORIGINS = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim());

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const app = createApp({ corsOrigins: CORS_ORIGINS });

const server = app.listen(PORT, () => {
  logger.info(`CreditOps backend running on port ${PORT} [${NODE_ENV}]`);
  logger.info(`Health → http://localhost:${PORT}/api/health`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function shutdown(signal: string): void {
  logger.info(`Received ${signal}. Shutting down gracefully…`);
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10 s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
