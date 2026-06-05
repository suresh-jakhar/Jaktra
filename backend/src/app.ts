import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health.router.js';
import { createAuthRouter } from './routes/auth.router.js';
import { createTenantRouter } from './routes/tenant.router.js';
import { createInvoiceImportRouter } from './routes/invoice-import.router.js';
import { UserRepository } from './repositories/user.repository.js';
import { TenantRepository } from './repositories/tenant.repository.js';
import { InvoiceRepository } from './repositories/invoice.repository.js';
import { AuthService } from './services/auth.service.js';
import { TenantService } from './services/tenant.service.js';
import { InvoiceImportService } from './services/invoice-import.service.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { tenantScoped } from './middleware/tenant-scoped.js';
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

  if (config.db && config.jwtSecret) {
    const userRepo = new UserRepository(config.db);
    const tenantRepo = new TenantRepository(config.db);
    const authService = new AuthService(userRepo, config.jwtSecret, config.jwtExpiresIn ?? '7d');
    const tenantService = new TenantService(tenantRepo);
    const authMiddleware = createAuthMiddleware(authService);
    app.use('/api/auth', createAuthRouter(authService, authMiddleware));
    app.use('/api/tenants', createTenantRouter(tenantService, authMiddleware));

    const invoiceRepo = new InvoiceRepository(config.db);
    const invoiceImportService = new InvoiceImportService(invoiceRepo);
    app.use('/api/invoices', createInvoiceImportRouter(invoiceImportService, authMiddleware, tenantScoped));
    app.locals.authMiddleware = authMiddleware;
    app.locals.authService = authService;
    app.locals.tenantScoped = tenantScoped;
  }

  return app;
}

