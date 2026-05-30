/**
 * app.ts
 *
 * Single Responsibility: compose the Express application.
 *   - Registers global middleware (CORS, JSON parsing)
 *   - Mounts routers under their base paths
 *   - Does NOT start the HTTP server (server lifecycle is in index.ts)
 *
 * Open/Closed: new routes are added by mounting them here; the factory
 *   function itself never needs modification.
 *
 * Dependency Inversion: receives config as a plain object instead of
 *   importing directly from process.env, making the app trivially testable.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health.router.js';
import { logger } from './utils/logger.js';

export interface AppConfig {
  corsOrigins: string[];
}

/**
 * Factory function — returns a fully-configured Express Application.
 * Accepting config via parameter (not reading process.env directly) keeps
 * this file free of side effects and easy to test in isolation.
 */
export function createApp(config: AppConfig): Application {
  const app = express();

  // ─── Global Middleware ───────────────────────────────────────────────────
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── Request Logging (lightweight, dev-friendly) ─────────────────────────
  app.use((req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`→ ${req.method} ${req.path}`);
    next();
  });

  // ─── Route Mounting ──────────────────────────────────────────────────────
  app.use('/api/health', healthRouter);

  return app;
}
