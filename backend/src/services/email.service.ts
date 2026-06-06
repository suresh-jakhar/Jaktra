import sgMail from '@sendgrid/mail';
import { EmailRepository } from '../repositories/email.repository.js';
import { logger } from '../utils/logger.js';

export interface SendEmailOptions {
  tenantId: string;
  to: string;
  subject: string;
  html: string;
  mode?: 'live' | 'dry_run';
}

export class EmailService {
  constructor(
    private readonly emailRepo: EmailRepository,
    private readonly sendgridApiKey?: string
  ) {
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    const { tenantId, to, subject, html, mode = 'dry_run' } = options;

    const settings = await this.emailRepo.getSettings(tenantId);
    if (!settings) {
      throw new Error('Email settings not configured for this tenant');
    }

    const from = {
      name: settings.senderName,
      email: settings.senderEmail,
    };

    const replyTo = settings.replyTo ? { email: settings.replyTo } : undefined;

    const msg = {
      to,
      from,
      replyTo,
      subject,
      html,
    };

    if (mode === 'dry_run') {
      logger.info(`[DRY RUN] Email to ${to} from ${from.email} (ReplyTo: ${replyTo?.email || 'N/A'}) - Subject: ${subject}`);
      return true;
    }

    if (!this.sendgridApiKey) {
      logger.warn(`[LIVE] Cannot send email to ${to} - SendGrid API Key is missing. Check .env config.`);
      throw new Error('SendGrid API key not configured globally');
    }

    try {
      await sgMail.send(msg);
      logger.info(`[LIVE] Email sent successfully to ${to} from ${from.email}`);
      return true;
    } catch (error: any) {
      logger.error(`[LIVE] Failed to send email to ${to}: ${error.message}`);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  async getSettings(tenantId: string) {
    return await this.emailRepo.getSettings(tenantId);
  }

  async updateSettings(tenantId: string, senderName: string, senderEmail: string, replyTo?: string) {
    return await this.emailRepo.upsertSettings(tenantId, {
      senderName,
      senderEmail,
      replyTo: replyTo || null,
    });
  }
}
