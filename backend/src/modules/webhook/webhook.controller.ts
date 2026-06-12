import { Request, Response } from 'express';
import { PaymentGatewayFactory } from '../../modules/payment/gateway.factory.js';
import type { WebhookService } from './webhook.service.js';
import { logger } from '../../shared/logger.js';
import type { SendgridWebhookService } from './providers/sendgrid.webhook.js';

import type { PaymentService } from '../payment/payment.service.js';

export class WebhookController {
  constructor(
    private gatewayFactory: PaymentGatewayFactory,
    private webhookService: WebhookService,
    private paymentService: PaymentService,
    private sendgridService?: SendgridWebhookService
  ) {}

  handleSendgrid = async (req: Request, res: Response): Promise<any> => {
    if (!this.sendgridService) {
      return res.status(501).json({ error: 'SendGrid webhook service not configured' });
    }

    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error(`Raw body is missing or not a buffer for sendgrid.`);
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const signature = req.headers['x-twilio-email-event-webhook-signature'];
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];

    try {
      await this.sendgridService.processEvents(
        rawBody,
        typeof signature === 'string' ? signature : undefined,
        typeof timestamp === 'string' ? timestamp : undefined
      );
      res.status(200).json({ status: 'success' });
    } catch (error: unknown) {
      logger.error('SendGrid webhook processing failed', { error });
      if (error instanceof Error && error.message.includes('signature')) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  handlePayment = async (req: Request, res: Response): Promise<any> => {
    const tenantId = req.params.tenantId as string;
    const provider = req.params.provider as string;
    
    if (!tenantId || !provider) {
      return res.status(400).json({ error: 'Tenant ID and Provider required' });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      return res.status(400).json({ error: 'Invalid Tenant ID format' });
    }

    const rawBody = req.body;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error(`Raw body is missing or not a buffer for provider ${provider}. Is express.raw() configured?`);
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const sigHeader = req.headers['x-razorpay-signature'] || req.headers['stripe-signature'];
    const rawSignature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
    
    if (!rawSignature || typeof rawSignature !== 'string') {
      logger.warn(`Missing signature header for provider ${provider}`);
      return res.status(400).json({ error: 'Missing signature' });
    }
    const signature: string = rawSignature;

    try {
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      const result = await this.paymentService.processPaymentCaptured(tenantId as string, provider as any, payload, rawBody, signature as string);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error(`Failed to process payment capture: ${error instanceof Error ? error.stack : JSON.stringify(error)}`);
      if (error.message === 'Invalid signature' || error.message?.includes('not registered')) {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
