import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import healthRouter from './routes/health.router.js';
import { createAuthRouter } from './routes/auth.router.js';
import { createTenantRouter } from './routes/tenant.router.js';
import { createInvoiceImportRouter } from './routes/invoice-import.router.js';
import { createTriageRouter } from './routes/triage.router.js';
import { createCommunicationRouter } from './routes/communication.router.js';
import { createEventRouter } from './routes/event.router.js';
import { createAimlRouter } from './routes/aiml.router.js';
import { createAgentRouter } from './routes/agent.router.js';
import { createDlqRouter } from './routes/dlq.router.js';
import { createEmailRouter } from './routes/email.router.js';
import { UserRepository } from './repositories/user.repository.js';
import { TenantRepository } from './repositories/tenant.repository.js';
import { InvoiceRepository } from './repositories/invoice.repository.js';
import { CommunicationRepository } from './repositories/communication.repository.js';
import { EventRepository } from './repositories/event.repository.js';
import { AuthService } from './services/auth.service.js';
import { TenantService } from './services/tenant.service.js';
import { InvoiceImportService } from './services/invoice-import.service.js';
import { TriageService } from './services/triage.service.js';
import { CommunicationService } from './services/communication.service.js';
import { EventService } from './services/event.service.js';
import { AimlService } from './services/aiml.service.js';
import { AgentService } from './services/agent.service.js';
import { DlqService } from './services/dlq.service.js';
import { EmailService } from './services/email.service.js';
import { AgentRepository } from './repositories/agent.repository.js';
import { DlqRepository } from './repositories/dlq.repository.js';
import { EmailRepository } from './repositories/email.repository.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { tenantScoped } from './middleware/tenant-scoped.js';
import { logger } from './utils/logger.js';
import type { DatabaseClient } from './db/index.js';

export interface AppConfig {
  corsOrigins: string[];
  db?: DatabaseClient;
  jwtSecret?: string;
  jwtExpiresIn?: string;
  aimlServiceUrl?: string;
  sendgridApiKey?: string;
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
    const triageService = new TriageService();
    app.use('/api/invoices', createInvoiceImportRouter(invoiceImportService, authMiddleware, tenantScoped));
    app.use('/api/invoices', createTriageRouter(triageService, invoiceRepo, authMiddleware, tenantScoped));

    const communicationRepo = new CommunicationRepository(config.db);
    const communicationService = new CommunicationService(communicationRepo, invoiceRepo);
    app.use('/api', createCommunicationRouter(communicationService, authMiddleware, tenantScoped));

    const eventRepo = new EventRepository(config.db);
    const eventService = new EventService(eventRepo, invoiceRepo);
    app.use('/api', createEventRouter(eventService, authMiddleware, tenantScoped));
    
    app.locals.authMiddleware = authMiddleware;
    app.locals.authService = authService;
    app.locals.tenantScoped = tenantScoped;

    if (config.aimlServiceUrl) {
      const aimlService = new AimlService({ baseUrl: config.aimlServiceUrl });
      app.use('/api/aiml', createAimlRouter(aimlService, authMiddleware));
      app.locals.aimlService = aimlService;

      const dlqRepo = new DlqRepository(config.db);
      const dlqService = new DlqService(dlqRepo);
      app.use('/api/dlq', createDlqRouter(dlqService, authMiddleware, tenantScoped));

      const emailRepo = new EmailRepository(config.db);
      const emailService = new EmailService(emailRepo, config.sendgridApiKey);
      app.use('/api/settings/email', createEmailRouter(emailService, authMiddleware, tenantScoped));

      const agentRepo = new AgentRepository(config.db);
      const agentService = new AgentService(agentRepo, aimlService, invoiceRepo, triageService, eventService, dlqService);
      app.use('/api/agent', createAgentRouter(agentService, authMiddleware, tenantScoped));
    }
  }

  return app;
}

