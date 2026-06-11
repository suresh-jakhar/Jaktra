import { z } from 'zod';
import type { CommunicationRepository } from './communication.repository.js';
import type { InvoiceRepository } from '../invoice/invoice.repository.js';
import type { Communication } from '../../db/index.js';

export const createCommunicationSchema = z.object({
  invoiceId: z.string().uuid(),
  channel: z.enum(['email', 'sms', 'whatsapp']),
  subject: z.string().optional(),
  body: z.string().optional(),
  status: z.enum(['pending', 'sent', 'failed']),
  sentAt: z.coerce.date().optional(),
  error: z.string().optional(),
});

export type CreateCommunicationInput = z.infer<typeof createCommunicationSchema>;

import type { EventRepository } from '../event/event.repository.js';
import type { SendgridProvider } from './providers/sendgrid.provider.js';

export interface SendCommunicationOptions {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  channel?: 'email' | 'sms' | 'whatsapp';
}

export class CommunicationService {
  constructor(
    private communicationRepo: CommunicationRepository,
    private invoiceRepo: InvoiceRepository,
    private sendgridProvider: SendgridProvider,
    private eventRepo?: EventRepository
  ) {}

  async listByInvoice(invoiceId: string, tenantId: string): Promise<Communication[]> {
    const invoice = await this.invoiceRepo.findById(invoiceId);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new CommunicationError('Invoice not found', 404);
    }
    return this.communicationRepo.findByInvoiceId(invoiceId);
  }

  async create(input: CreateCommunicationInput, tenantId: string): Promise<Communication> {
    const invoice = await this.invoiceRepo.findById(input.invoiceId);
    if (!invoice || invoice.tenantId !== tenantId) {
      throw new CommunicationError('Invoice not found', 404);
    }

    return this.communicationRepo.create({
      invoiceId: input.invoiceId,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body ?? null,
      status: input.status,
      sentAt: input.sentAt ?? null,
      error: input.error ?? null,
    });
  }

  async handleEmailEvent(
    communicationId: string,
    invoiceId: string,
    eventType: 'opened' | 'clicked' | 'bounced' | 'dropped',
    timestamp: Date,
    rawEvent: any
  ): Promise<void> {
    if (eventType === 'opened') {
      await this.communicationRepo.updateOpenedAt(communicationId, timestamp);
    } else if (eventType === 'clicked') {
      await this.communicationRepo.updateClickedAt(communicationId, timestamp);
    } else if (eventType === 'bounced' || eventType === 'dropped') {
      await this.communicationRepo.markFailed(communicationId, rawEvent.reason || 'Email bounced or dropped');
    }

    if (this.eventRepo) {
      const dbEventType = `email_${eventType === 'dropped' ? 'bounced' : eventType}`;
      await this.eventRepo.create({
        invoiceId,
        eventType: dbEventType,
        actor: 'system',
        payload: rawEvent
      });
    }
  }

  // --- Sending Orchestration ---

  async send(options: SendCommunicationOptions): Promise<boolean> {
    const { tenantId, to, subject, html, channel = 'email' } = options;

    if (channel !== 'email') {
      throw new Error(`Channel ${channel} is not supported yet`);
    }

    const settings = await this.communicationRepo.getSettings(tenantId);
    if (!settings) {
      throw new Error('Communication settings not configured for this tenant');
    }

    const from = {
      name: settings.senderName,
      email: settings.senderEmail,
    };

    const replyTo = settings.replyTo ? { email: settings.replyTo } : undefined;

    return this.sendgridProvider.sendEmail(to, from, replyTo, subject, html);
  }

  // --- Provider Settings ---

  async getSettings(tenantId: string) {
    return await this.communicationRepo.getSettings(tenantId);
  }

  async updateSettings(tenantId: string, senderName: string, senderEmail: string, replyTo?: string, idempotencyWindowHours: number = 20) {
    return await this.communicationRepo.upsertSettings(tenantId, {
      senderName,
      senderEmail,
      replyTo: replyTo || null,
      idempotencyWindowHours,
    });
  }
}

export class CommunicationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'CommunicationError';
  }
}
