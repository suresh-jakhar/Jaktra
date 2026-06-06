import { Router, Request, Response } from 'express';
import express from 'express';
import { PaymentGatewayFactory } from '../services/payment/gateway.factory.js';
import { WebhookService } from '../services/webhook.service.js';
import { logger } from '../utils/logger.js';

export function createWebhookRouter(
  gatewayFactory: PaymentGatewayFactory,
  webhookService: WebhookService,
  webhookSecrets: Record<string, string> // e.g. { razorpay: process.env.RAZORPAY_WEBHOOK_SECRET }
): Router {
  const router = Router();

  router.post(
    '/:provider',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const providerParam = req.params.provider;
      const providerName = typeof providerParam === 'string' ? providerParam.toLowerCase() : undefined;
      
      if (!providerName) {
        return res.status(400).json({ error: 'Provider name required' });
      }

      const adapter = gatewayFactory.getAdapter(providerName);
      if (!adapter) {
        logger.warn(`No payment gateway adapter found for provider: ${providerName}`);
        return res.status(404).json({ error: 'Unsupported payment provider' });
      }

      const rawBody = req.body;
      if (!rawBody || !Buffer.isBuffer(rawBody)) {
        logger.error(`Raw body is missing or not a buffer for provider ${providerName}. Is express.raw() configured?`);
        return res.status(400).json({ error: 'Invalid request body' });
      }

      // Get the appropriate signature header (e.g. x-razorpay-signature, stripe-signature)
      // Usually, we'll try common header names or we could add a `getSignatureHeaderName()` to the interface.
      // For simplicity, we check a few known headers.
      const signature = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        logger.warn(`Missing signature header for provider ${providerName}`);
        return res.status(400).json({ error: 'Missing signature' });
      }

      const secret = webhookSecrets[providerName];
      if (!secret) {
        logger.error(`Webhook secret not configured for provider ${providerName}`);
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const isValid = adapter.verifyWebhookSignature(rawBody, signature, secret);
      if (!isValid) {
        logger.warn(`Invalid signature for provider ${providerName}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const payload = adapter.parseWebhookEvent(rawBody);
      if (!payload) {
        // Event might be unsupported or unparseable, we return 200 to acknowledge receipt
        // to prevent the provider from endlessly retrying.
        return res.status(200).json({ status: 'ignored' });
      }

      if (payload.status === 'captured') {
        try {
          await webhookService.handlePaymentCaptured(payload);
        } catch (error) {
          logger.error(`Failed to process payment capture`, { error });
          return res.status(500).json({ error: 'Internal server error' });
        }
      }

      res.status(200).json({ status: 'success' });
    }
  );

  return router;
}
