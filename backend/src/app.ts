import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health.router.js';
import { createAuthRouter } from './routes/auth.router.js';
import { UserRepository } from './repositories/user.repository.js';
import { AuthService } from './services/auth.service.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { logger } from './utils/logger.js';
import type { DatabaseClient } from './db/index.js';

export interface AppConfig {
  corsOrigins: string[];
  db?: DatabaseClient;
  jwtSecret?: string;
  jwtExpiresIn?: string;
}

export function createApp(config: AppConfig): Application {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, _res: Response, next: NextFunction): void => {
    logger.info(`→ ${req.method} ${req.path}`);
    next();
  });

  app.use('/api/health', healthRouter);

  // Auth routes require db + jwt config
  if (config.db && config.jwtSecret) {
    const userRepo = new UserRepository(config.db);
    const authService = new AuthService(userRepo, config.jwtSecret, config.jwtExpiresIn ?? '7d');
    const authMiddleware = createAuthMiddleware(authService);

    app.use('/api/auth', createAuthRouter(authService));

    // Expose on app.locals so other routers can reference them
    app.locals.authMiddleware = authMiddleware;
    app.locals.authService = authService;
  }

  return app;
}

