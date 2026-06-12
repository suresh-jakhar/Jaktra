import { Router } from 'express';
import express from 'express';
import { WebhookController } from './webhook.controller.js';

export function createWebhookRouter(
  webhookController: WebhookController
): Router {
  const router = Router();

  // SendGrid Email Webhooks
  router.post(
    '/sendgrid',
    express.raw({ type: 'application/json' }),
    webhookController.handleSendgrid
  );

  // Payment Gateways
  router.post(
    '/payments/:tenantId/:provider',
    express.raw({ type: 'application/json', limit: '2mb' }),
    webhookController.handlePayment
  );

  return router;
}
