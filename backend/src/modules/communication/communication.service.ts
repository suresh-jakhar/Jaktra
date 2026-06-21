import { z } from 'zod';
import type { CommunicationRepository } from './communication.repository.js';
import type { InvoiceRepository } from '../invoice/invoice.repository.js';
import type { Communication } from '../../db/index.js';
import { CommunicationError } from '../../shared/errors/index.js';
import * as dns from 'dns/promises';
import { logger } from '../../shared/logger.js';
import type { DlqRepository } from '../dlq/dlq.repository.js';
import tls from 'tls';
import type { SmtpConfig } from './providers/smtp.factory.js';

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
  invoiceId?: string;
}

export class CommunicationService {
  constructor(
    private communicationRepo: CommunicationRepository,
    private invoiceRepo: InvoiceRepository,
    private integrationService: IntegrationService,
    private eventRepo?: EventRepository,
    private dlqRepo?: DlqRepository
  ) {}

  async listByInvoice(invoiceId: string, tenantId: string): Promise<any[]> {
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
      tenantId,
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
    tenantId: string,
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
      const reason = rawEvent.reason || 'Email bounced or dropped';
      await this.communicationRepo.markFailed(communicationId, reason);

      // Decrement the followupCount on the invoice
      try {
        const invoice = await this.invoiceRepo.findById(invoiceId);
        if (invoice) {
          const newCount = Math.max(0, invoice.followupCount - 1);
          await this.invoiceRepo.update(invoiceId, tenantId, {
            followupCount: newCount,
          });
        }
      } catch (err) {
        logger.error(`Failed to update followupCount on bounce for invoice ${invoiceId}`, err);
      }

      // Record in the Dead Letter Queue (DLQ)
      if (this.dlqRepo) {
        try {
          await this.dlqRepo.recordFailure(
            invoiceId,
            tenantId,
            `Delivery failed: ${reason}`,
            JSON.stringify(rawEvent)
          );
        } catch (err) {
          logger.error(`Failed to record bounce in DLQ for invoice ${invoiceId}`, err);
        }
      }
    }

    if (this.eventRepo) {
      const dbEventType = `email_${eventType === 'dropped' ? 'bounced' : eventType}`;
      await this.eventRepo.create({
        tenantId,
        invoiceId,
        eventType: dbEventType,
        actor: 'system',
        payload: rawEvent
      });
    }
  }

  async validateRecipientEmail(email: string): Promise<void> {
    const domain = email.split('@')[1];
    if (!domain) {
      throw new CommunicationError(`Invalid recipient email address format: ${email}`, 400);
    }
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) {
        throw new CommunicationError(`Recipient domain '${domain}' has no valid mail servers (MX records). Delivery will fail.`, 400);
      }
    } catch (err: any) {
      throw new CommunicationError(`Recipient domain '${domain}' is unreachable or invalid: ${err.message}`, 400);
    }
  }

  async send(options: SendCommunicationOptions): Promise<boolean> {
    const { tenantId, to, subject, html, channel = 'email', invoiceId } = options;

    if (channel !== 'email') {
      throw new CommunicationError(
        `${channel.toUpperCase()} channel is currently disabled. Only email is operational.`,
        501
      );
    }

    // Validate email domain MX records synchronously to catch typos/non-existent domains
    await this.validateRecipientEmail(to);

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

        // Start background polling for bounces if invoiceId is provided
        if (invoiceId) {
          this.startSmtpBouncePolling(tenantId, invoiceId, to, smtpConfig).catch((err) => {
            logger.error(`Error in background SMTP bounce polling for invoice ${invoiceId}:`, err);
          });
        }

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

  private async checkImapForBounce(smtpConfig: SmtpConfig, recipient: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const host = getImapHost(smtpConfig.host);
      const port = 993; // standard IMAP over TLS port
      const username = smtpConfig.username;
      const password = smtpConfig.password;

      const socket = tls.connect(port, host, { rejectUnauthorized: false }, () => {
        logger.debug(`[IMAP] Connected to ${host}:${port} for bounce check`);
      });

      socket.setTimeout(10000); // 10s socket timeout

      let commandStep = 0;
      let buffer = '';
      let foundBounce = false;

      const sendCmd = (tag: string, cmd: string) => {
        logger.debug(`[IMAP] Sent: ${tag} ${cmd}`);
        socket.write(`${tag} ${cmd}\r\n`);
      };

      socket.on('data', (data) => {
        buffer += data.toString('utf8');
        
        // Process responses line-by-line
        while (buffer.includes('\r\n')) {
          const lineEnd = buffer.indexOf('\r\n');
          const line = buffer.substring(0, lineEnd);
          buffer = buffer.substring(lineEnd + 2);
          
          logger.debug(`[IMAP] Received: ${line}`);

          if (commandStep === 0 && line.includes('* OK')) {
            commandStep = 1;
            sendCmd('A1', `LOGIN "${username}" "${password}"`);
          } else if (commandStep === 1 && line.startsWith('A1 ')) {
            if (line.includes('OK')) {
              commandStep = 2;
              sendCmd('A2', 'SELECT INBOX');
            } else {
              socket.destroy();
              reject(new Error(`IMAP Login failed: ${line}`));
              return;
            }
          } else if (commandStep === 2 && line.startsWith('A2 ')) {
            if (line.includes('OK')) {
              commandStep = 3;
              // Search for bounces of this recipient
              sendCmd('A3', `SEARCH FROM "mailer-daemon" TEXT "${recipient}"`);
            } else {
              socket.destroy();
              reject(new Error(`IMAP SELECT INBOX failed: ${line}`));
              return;
            }
          } else if (commandStep === 3) {
            if (line.startsWith('* SEARCH')) {
              const ids = line.replace('* SEARCH', '').trim();
              if (ids.length > 0) {
                foundBounce = true;
              }
            } else if (line.startsWith('A3 ')) {
              commandStep = 4;
              sendCmd('A4', 'LOGOUT');
            }
          } else if (commandStep === 4 && line.startsWith('A4 ')) {
            socket.destroy();
            resolve(foundBounce);
            return;
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('IMAP connection timed out'));
      });

      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });

      socket.on('close', () => {
        resolve(foundBounce);
      });
    });
  }

  private async startSmtpBouncePolling(
    tenantId: string,
    invoiceId: string,
    recipient: string,
    smtpConfig: SmtpConfig
  ): Promise<void> {
    const maxPolls = 8; // 8 * 15 seconds = 2 minutes
    const pollIntervalMs = 15000;

    logger.info(`[IMAP] Starting SMTP bounce polling for invoice ${invoiceId} / recipient ${recipient}`);

    for (let attempt = 1; attempt <= maxPolls; attempt++) {
      // Wait for interval
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      logger.debug(`[IMAP] Checking for bounce. Attempt ${attempt}/${maxPolls}`);
      try {
        const isBounced = await this.checkImapForBounce(smtpConfig, recipient);
        if (isBounced) {
          logger.warn(`[IMAP] Asynchronous bounce detected for invoice ${invoiceId} recipient ${recipient}`);
          
          // 1. Mark latest sent communication as failed
          const comms = await this.communicationRepo.findByInvoiceId(invoiceId);
          const latestSent = comms.find((c) => c.status === 'sent');
          if (latestSent) {
            await this.communicationRepo.markFailed(
              latestSent.id,
              'Email bounced: Recipient mailbox does not exist'
            );
          }

          // 2. Decrement invoice followupCount
          const invoice = await this.invoiceRepo.findById(invoiceId);
          if (invoice) {
            const newCount = Math.max(0, invoice.followupCount - 1);
            await this.invoiceRepo.update(invoiceId, tenantId, {
              followupCount: newCount,
            });
          }

          // 3. Emit halted event with mail_invalid reason
          if (this.eventRepo) {
            await this.eventRepo.create({
              tenantId,
              invoiceId,
              eventType: 'halted',
              actor: 'system',
              payload: {
                reason: 'mail_invalid',
                error: 'Recipient email address does not exist',
                recipient,
              },
            });
          }

          // 4. Record failure in DLQ
          if (this.dlqRepo) {
            await this.dlqRepo.recordFailure(
              invoiceId,
              tenantId,
              'Delivery failed: Mailbox does not exist (bounced)',
              `Recipient email address ${recipient} is invalid or non-existent.`
            );
          }

          // Stop polling
          return;
        }
      } catch (err: any) {
        logger.error(`[IMAP] Error checking bounce on attempt ${attempt}: ${err.message}`);
      }
    }

    logger.info(`[IMAP] Finished SMTP bounce polling for invoice ${invoiceId} / recipient ${recipient} with no bounce detected.`);
  }
}

function getImapHost(smtpHost: string): string {
  const host = smtpHost.toLowerCase();
  if (host.includes('gmail.com')) return 'imap.gmail.com';
  if (host.includes('yahoo.com')) return 'imap.mail.yahoo.com';
  if (host.includes('outlook.com') || host.includes('office365.com')) return 'outlook.office365.com';
  return smtpHost.replace(/^smtp\./i, 'imap.');
}


