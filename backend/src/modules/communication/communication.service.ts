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
import type { IntegrationService } from '../settings/integration.service.js';
import { SendgridProvider } from './providers/sendgrid.provider.js';
import { SmtpProvider } from './providers/smtp.provider.js';

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
    private integrationService: IntegrationService,
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


  async send(options: SendCommunicationOptions): Promise<boolean> {
    const { tenantId, to, subject, html, channel = 'email' } = options;

    if (channel !== 'email') {
      throw new Error(`Channel ${channel} is not supported yet`);
    }

    const settings = await this.communicationRepo.getSettings(tenantId);
    if (!settings || !settings.senderEmail) {
      throw new CommunicationError('Communication settings not configured for this tenant', 400);
    }

    const from = {
      name: settings.senderName,
      email: settings.senderEmail,
    };
    const replyTo = settings.replyTo ? { email: settings.replyTo } : undefined;

    const defaultProvider = (settings as any).defaultEmailProvider;
    if (!defaultProvider) {
      throw new CommunicationError('EMAIL_PROVIDER_NOT_CONFIGURED', 400);
    }

    try {
      if (defaultProvider === 'sendgrid') {
        const apiKey = await this.integrationService.getDecryptedSendgridKey(tenantId);
        const provider = new SendgridProvider(apiKey);
        await provider.sendEmail(to, from, replyTo, subject, html);
        return true;
      } else if (defaultProvider === 'smtp') {
        const smtpConfig = await this.integrationService.getDecryptedSmtpConfig(tenantId);
        const provider = new SmtpProvider(smtpConfig);
        await provider.sendEmail(to, from, replyTo, subject, html);
        return true;
      } else {
        throw new CommunicationError(`Unsupported default email provider: ${defaultProvider}`, 400);
      }
    } catch (error: any) {
      if (error instanceof CommunicationError) throw error;
      
      await this.integrationService.handleDeliveryError(tenantId, defaultProvider, error);
      throw error;
    }
  }

  async testConnection(tenantId: string, to: string): Promise<boolean> {
    return this.send({
      tenantId,
      to,
      subject: 'Integration Test',
      html: '<p>Your email integration is working correctly.</p>',
    });
  }


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

  async setDefaultEmailProvider(tenantId: string, provider: 'sendgrid' | 'smtp' | null): Promise<void> {
    await this.communicationRepo.setDefaultEmailProvider(tenantId, provider);
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
