import { WebhookEventPayload } from './payment/gateway.interface.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { EventRepository } from '../repositories/event.repository.js';
import { logger } from '../utils/logger.js';

export class WebhookService {
  constructor(
    private invoiceRepo: InvoiceRepository,
    private eventRepo: EventRepository
  ) {}

  async handlePaymentCaptured(payload: WebhookEventPayload): Promise<void> {
    if (!payload.invoiceId) {
      logger.warn(`Webhook received for ${payload.provider} but no invoiceId found in payload.`);
      return;
    }

    try {
      const invoice = await this.invoiceRepo.findById(payload.invoiceId);

      if (!invoice) {
        logger.warn(`Invoice ${payload.invoiceId} not found for webhook event.`);
        return;
      }

      if (invoice.paymentStatus === 'Paid') {
        logger.info(`Invoice ${invoice.id} is already marked as Paid. Skipping webhook processing.`);
        return;
      }

      // Update invoice status
      await this.invoiceRepo.updatePaymentStatus(invoice.id, 'Paid', payload.externalRefId);

      // Record timeline event
      await this.eventRepo.create({
        invoiceId: invoice.id,
        eventType: 'payment_received',
        actor: 'system',
        payload: {
          provider: payload.provider,
          amount: payload.amount,
          externalRefId: payload.externalRefId,
        }
      });

      logger.info(`Successfully processed payment capture for invoice ${invoice.id} from ${payload.provider}`);
    } catch (error) {
      logger.error(`Error processing webhook event for invoice ${payload.invoiceId}`, { error });
      throw error;
    }
  }
}
