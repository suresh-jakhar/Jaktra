import { EventWebhook } from '@sendgrid/eventwebhook';
import { CommunicationService } from '../../communication/communication.service.js';
import { logger } from '../../../shared/logger.js';

export class SendgridWebhookService {
  private eventWebhook: EventWebhook;

  constructor(
    private communicationService: CommunicationService,
    private publicKey?: string
  ) {
    this.eventWebhook = new EventWebhook();
  }

  verifySignature(publicKey: string, payload: string, signature: string, timestamp: string): boolean {
    try {
      const ecPublicKey = this.eventWebhook.convertPublicKeyToECDSA(publicKey);
      return this.eventWebhook.verifySignature(ecPublicKey, payload, signature, timestamp);
    } catch (error) {
      logger.error('Error verifying SendGrid webhook signature', { error });
      return false;
    }
  }

  async processEvents(rawBody: Buffer, signature?: string, timestamp?: string): Promise<void> {
    if (this.publicKey && signature && timestamp) {
      const isValid = this.verifySignature(this.publicKey, rawBody.toString('utf8'), signature, timestamp);
      if (!isValid) {
        throw new Error('Invalid SendGrid webhook signature');
      }
    } else if (this.publicKey) {
      throw new Error('Missing SendGrid webhook signature headers');
    }

    let events: any[] = [];
    try {
      events = JSON.parse(rawBody.toString('utf8'));
      if (!Array.isArray(events)) {
        events = [events]; 
      }
    } catch (error) {
      logger.error('Failed to parse SendGrid webhook payload', { error });
      throw new Error('Invalid JSON payload');
    }

    for (const event of events) {
      const { event: eventType, communication_id, invoice_id, tenant_id, timestamp: eventTimestamp } = event;

      if (!communication_id || !invoice_id) {
        continue;
      }

      const tenantId = tenant_id || '';

      if (['opened', 'open'].includes(eventType)) {
        await this.communicationService.handleEmailEvent(
          tenantId,
          communication_id,
          invoice_id,
          'opened',
          new Date(eventTimestamp * 1000),
          event
        );
      } else if (['clicked', 'click'].includes(eventType)) {
        await this.communicationService.handleEmailEvent(
          tenantId,
          communication_id,
          invoice_id,
          'clicked',
          new Date(eventTimestamp * 1000),
          event
        );
      } else if (['bounced', 'bounce'].includes(eventType)) {
        await this.communicationService.handleEmailEvent(
          tenantId,
          communication_id,
          invoice_id,
          'bounced',
          new Date(eventTimestamp * 1000),
          event
        );
      } else if (['dropped', 'drop'].includes(eventType)) {
        await this.communicationService.handleEmailEvent(
          tenantId,
          communication_id,
          invoice_id,
          'dropped',
          new Date(eventTimestamp * 1000),
          event
        );
      }
    }
  }
}
