import crypto from 'crypto';
import { IPaymentGateway, WebhookEventPayload } from '../gateway.interface.js';
import { logger } from '../../../utils/logger.js';

export class RazorpayAdapter implements IPaymentGateway {
  getProviderName(): string {
    return 'razorpay';
  }

  verifyWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret || !rawBody) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying Razorpay signature', { error });
      return false;
    }
  }

  parseWebhookEvent(rawBody: Buffer): WebhookEventPayload | null {
    try {
      const parsedBody = JSON.parse(rawBody.toString('utf8'));

      if (parsedBody.event === 'payment.captured') {
        const entity = parsedBody.payload?.payment?.entity;
        if (!entity) return null;

        return {
          provider: 'razorpay',
          invoiceId: entity.notes?.invoice_id,
          amount: entity.amount, // in paise
          status: 'captured',
          externalRefId: entity.id,
          rawEvent: parsedBody
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Error parsing Razorpay webhook payload', { error });
      return null;
    }
  }
}
