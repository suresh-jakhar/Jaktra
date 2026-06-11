import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createHealthRouter } from './modules/health/health.routes.js';
import { HealthController } from './modules/health/health.controller.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { createTenantRouter } from './modules/tenant/tenant.routes.js';
import { TenantController } from './modules/tenant/tenant.controller.js';
import { createInvoiceRouter } from './modules/invoice/invoice.routes.js';
import { InvoiceController } from './modules/invoice/invoice.controller.js';
import { createTriageRouter } from './modules/agent/triage.routes.js';
import { TriageController } from './modules/agent/triage.controller.js';
import { createReconcilerRouter } from './modules/agent/reconciler.routes.js';
import { ReconcilerController } from './modules/agent/reconciler.controller.js';
import { createCommunicationRouter } from './modules/communication/communication.routes.js';
import { CommunicationController } from './modules/communication/communication.controller.js';
import { createEventRouter } from './modules/event/event.routes.js';
import { EventController } from './modules/event/event.controller.js';
import { createAimlRouter } from './modules/agent/aiml.routes.js';
import { AimlController } from './modules/agent/aiml.controller.js';
import { createAgentRouter } from './modules/agent/agent.routes.js';
import { AgentController } from './modules/agent/agent.controller.js';
import { createDlqRouter } from './modules/dlq/dlq.routes.js';
import { DlqController } from './modules/dlq/dlq.controller.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { AnalyticsController } from './modules/analytics/analytics.controller.js';
import { createSettingsRouter } from './modules/settings/settings.routes.js';
import { SettingsController } from './modules/settings/settings.controller.js';
import { createWebhookRouter } from './modules/webhook/webhook.routes.js';
import { WebhookController } from './modules/webhook/webhook.controller.js';
import { createTeamRouter } from './modules/team/team.routes.js';
import { TeamController } from './modules/team/team.controller.js';

import { UserRepository } from './modules/auth/user.repository.js';
import { TenantRepository } from './modules/tenant/tenant.repository.js';
import { InvoiceRepository } from './modules/invoice/invoice.repository.js';
import { CommunicationRepository } from './modules/communication/communication.repository.js';
import { EventRepository } from './modules/event/event.repository.js';
import { AgentRepository } from './modules/agent/agent.repository.js';
import { DlqRepository } from './modules/dlq/dlq.repository.js';
import { AnalyticsRepository } from './modules/analytics/analytics.repository.js';
import { SettingsRepository } from './modules/settings/settings.repository.js';
import { TeamRepository } from './modules/team/team.repository.js';

import { AuthService } from './modules/auth/auth.service.js';
import { TenantService } from './modules/tenant/tenant.service.js';
import { InvoiceImportService } from './modules/invoice/invoice.service.js';
import { TriageService } from './modules/agent/triage.service.js';
import { ReconcilerService } from './modules/agent/reconciler.service.js';
import { CommunicationService } from './modules/communication/communication.service.js';
import { EventService } from './modules/event/event.service.js';
import { AimlService } from './modules/agent/aiml.service.js';
import { AgentService } from './modules/agent/agent.service.js';
import { DlqService } from './modules/dlq/dlq.service.js';
import { AnalyticsService } from './modules/analytics/analytics.service.js';
import { IdempotencyService } from './modules/communication/services/idempotency.service.js';
import { SettingsService } from './modules/settings/settings.service.js';
import { TeamService } from './modules/team/team.service.js';

import { createAuthMiddleware } from './middleware/auth.js';
import { tenantScoped } from './middleware/tenant-scoped.js';
import { logger } from './shared/logger.js';
import type { DatabaseClient } from './db/index.js';
import { IntegrationRepository } from './modules/settings/integration.repository.js';
import { IntegrationService } from './modules/settings/integration.service.js';
import { IntegrationController } from './modules/settings/integration.controller.js';
import { createIntegrationRouter } from './modules/settings/integration.routes.js';
import { PaymentGatewayFactory } from './modules/payment/gateway.factory.js';
import { RazorpayAdapter } from './modules/payment/adapters/razorpay.adapter.js';
import { WebhookService } from './modules/webhook/webhook.service.js';
import { SendgridWebhookService } from './modules/webhook/providers/sendgrid.webhook.js';
import { SendgridProvider } from './modules/communication/providers/sendgrid.provider.js';
import { standardLimiter, authLimiter } from './middleware/rate-limiter.js';
import { requestLogger } from './middleware/request-logger.js';
import { requestId } from './middleware/request-id.js';
import { errorHandler } from './middleware/error-handler.js';
import { NotFoundError } from './shared/errors/index.js';
import * as Sentry from '@sentry/node';

export interface AppConfig {
  corsOrigins: string[];
  db?: DatabaseClient;
  jwtSecret?: string;
  jwtExpiresIn?: string;
  aimlServiceUrl?: string;
  sendgridApiKey?: string;
  razorpayWebhookSecret?: string;
  sendgridWebhookPublicKey?: string;
}

export function createApp(config: AppConfig): Application {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  const app = express();

  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    })
  );

  if (config.db) {
    const invoiceRepo = new InvoiceRepository(config.db);
    const eventRepo = new EventRepository(config.db);
    const communicationRepo = new CommunicationRepository(config.db);
    const integrationRepo = new IntegrationRepository(config.db);
    const integrationService = new IntegrationService(integrationRepo);
    const communicationService = new CommunicationService(communicationRepo, invoiceRepo, integrationService, eventRepo);
    
    const gatewayFactory = new PaymentGatewayFactory();
    gatewayFactory.register(new RazorpayAdapter());
    
    const webhookService = new WebhookService(invoiceRepo, eventRepo);
    const sendgridService = new SendgridWebhookService(communicationService, config.sendgridWebhookPublicKey);
    
    const webhookSecrets: Record<string, string> = {};
    if (config.razorpayWebhookSecret) {
      webhookSecrets['razorpay'] = config.razorpayWebhookSecret;
    }
    
    app.use('/api/webhooks', createWebhookRouter(new WebhookController(gatewayFactory, webhookService, webhookSecrets, sendgridService)));
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(requestId);
  app.use(requestLogger);
  
  // Apply standard rate limit to all routes
  app.use(standardLimiter);

  const healthController = new HealthController();
  app.use('/api/health', createHealthRouter(healthController));

  if (config.db && config.jwtSecret) {
    const userRepo = new UserRepository(config.db);
    const tenantRepo = new TenantRepository(config.db);
    const authService = new AuthService(userRepo, config.jwtSecret, config.jwtExpiresIn ?? '7d');
    const tenantService = new TenantService(tenantRepo);
    const authMiddleware = createAuthMiddleware(authService);
    
    const authRouter = createAuthRouter(new AuthController(authService), authMiddleware);
    app.use('/api/auth', authLimiter, authRouter);
    
    app.use('/api/tenants', createTenantRouter(new TenantController(tenantService), authMiddleware));

    const teamRepo = new TeamRepository(config.db);
    const teamService = new TeamService(teamRepo, userRepo);
    app.use('/api/team', createTeamRouter(new TeamController(teamService, teamRepo), authMiddleware));

    const invoiceRepo = new InvoiceRepository(config.db);
    const invoiceImportService = new InvoiceImportService(invoiceRepo);
    const triageService = new TriageService();
    app.use('/api/invoices', createInvoiceRouter(new InvoiceController(invoiceImportService, invoiceRepo), authMiddleware, tenantScoped));
    app.use('/api/invoices', createTriageRouter(new TriageController(triageService, invoiceRepo), authMiddleware, tenantScoped));

    const analyticsRepo = new AnalyticsRepository(config.db);
    const analyticsService = new AnalyticsService(analyticsRepo);
    app.use('/api/analytics', createAnalyticsRouter(new AnalyticsController(analyticsService), authMiddleware, tenantScoped));

    const settingsRepo = new SettingsRepository(config.db);
    const settingsService = new SettingsService(settingsRepo);
    app.use('/api/settings', createSettingsRouter(new SettingsController(settingsService), authMiddleware, tenantScoped));

    const communicationRepo = new CommunicationRepository(config.db);
    const reconcilerService = new ReconcilerService(invoiceRepo, communicationRepo);
    app.use('/api/invoices', createReconcilerRouter(new ReconcilerController(reconcilerService), authMiddleware, tenantScoped));

    const eventRepo = new EventRepository(config.db);
    const eventService = new EventService(eventRepo, invoiceRepo);
    app.use('/api', createEventRouter(new EventController(eventService), authMiddleware, tenantScoped));

    const integrationRepo = new IntegrationRepository(config.db);
    const integrationService = new IntegrationService(integrationRepo);

    const communicationService = new CommunicationService(communicationRepo, invoiceRepo, integrationService, eventRepo);
    app.use('/api/settings/communication', createCommunicationRouter(new CommunicationController(communicationService), authMiddleware, tenantScoped));
    
    app.use('/api/settings/integrations', authMiddleware, tenantScoped, createIntegrationRouter(new IntegrationController(integrationService, communicationService)));
    
    app.use('/api/settings', createSettingsRouter(new SettingsController(settingsService), authMiddleware, tenantScoped));
    app.locals.authMiddleware = authMiddleware;
    app.locals.authService = authService;
    app.locals.tenantScoped = tenantScoped;

    if (config.aimlServiceUrl) {
      const aimlService = new AimlService({ baseUrl: config.aimlServiceUrl });
      app.use('/api/aiml', createAimlRouter(new AimlController(aimlService), authMiddleware));
      app.locals.aimlService = aimlService;

      const dlqRepo = new DlqRepository(config.db);
      const dlqService = new DlqService(dlqRepo);
      app.use('/api/dlq', createDlqRouter(new DlqController(dlqService), authMiddleware, tenantScoped));

      const idempotencyService = new IdempotencyService(communicationRepo);

      const agentRepo = new AgentRepository(config.db);
      const agentService = new AgentService(agentRepo, aimlService, invoiceRepo, triageService, eventService, dlqService, idempotencyService);
      app.use('/api/agent', createAgentRouter(new AgentController(agentService), authMiddleware, tenantScoped));
    }
  }

  // 404 Fallback
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.path} not found`));
  });

  app.use(errorHandler);

  return app;
}
