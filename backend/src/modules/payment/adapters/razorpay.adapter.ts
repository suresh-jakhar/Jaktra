import crypto from 'crypto';
import { IPaymentGateway, WebhookEventPayload } from '../gateway.interface.js';
import { logger } from '../../../shared/logger.js';

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

      const expectedBuffer = Buffer.from(expectedSignature);
      const signatureBuffer = Buffer.from(signature);

      if (expectedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
    } catch (error) {
      logger.error('Error verifying Razorpay signature', { error });
      return false;
    }
  }

  parseWebhookEvent(rawBody: Buffer): WebhookEventPayload | null {
    try {
      const parsedBody = JSON.parse(rawBody.toString('utf8'));

      if (parsedBody.event === 'payment.captured' || parsedBody.event === 'payment.failed') {
        const entity = parsedBody.payload?.payment?.entity;
        const paymentLinkEntity = parsedBody.payload?.payment_link?.entity;
        if (!entity) return null;

        const invoiceId = entity.notes?.invoice_id || paymentLinkEntity?.notes?.invoice_id;

        return {
          provider: 'razorpay',
          invoiceId: invoiceId,
          amount: entity.amount, // in paise
          currency: entity.currency,
          status: parsedBody.event === 'payment.captured' ? 'captured' : 'failed',
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

  async createPaymentLink(
    credentials: Record<string, string>,
    invoiceId: string,
    amount: number,
    currency: string,
    description: string
  ): Promise<{ paymentUrl: string; providerPaymentLinkId: string; providerOrderId?: string }> {
    const { keyId, keySecret } = credentials;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials missing keyId or keySecret');
    }

    const amountInPaise = Math.round(amount * 100);
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        accept_partial: false,
        description,
        notes: {
          invoice_id: invoiceId,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error('Razorpay createPaymentLink failed', { status: response.status, body: errorBody });
      throw new Error(`Razorpay API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json() as any;
    return {
      paymentUrl: data.short_url,
      providerPaymentLinkId: data.id,
      providerOrderId: data.order_id,
    };
  }
}
