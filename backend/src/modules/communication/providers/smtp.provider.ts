import { logger } from '../../../shared/logger.js';
import { SmtpConnectionFactory, SmtpConfig } from './smtp.factory.js';
import { ValidationError } from '../../../shared/errors/index.js';

export class SmtpProvider {
  constructor(private readonly config: SmtpConfig) {}

  private checkHeaderInjection(value: string | undefined): void {
    if (!value) return;
    if (value.includes('\r') || value.includes('\n')) {
      throw new ValidationError('Header injection detected. CR/LF characters are not allowed.');
    }
  }

  async sendEmail(
    to: string,
    from: { name: string; email: string },
    replyTo: { email: string } | undefined,
    subject: string,
    html: string
  ): Promise<boolean> {
    // Validate inputs against header injection
    this.checkHeaderInjection(to);
    this.checkHeaderInjection(from.name);
    this.checkHeaderInjection(from.email);
    if (replyTo) this.checkHeaderInjection(replyTo.email);
    this.checkHeaderInjection(subject);

    const msg = {
      to,
      from: `"${from.name}" <${from.email}>`,
      replyTo: replyTo?.email,
      subject,
      html,
    };

    let transporter;
    try {
      transporter = await SmtpConnectionFactory.createTransporter(this.config);
      
      const info = await SmtpConnectionFactory.executeWithTimeout(
        transporter,
        () => transporter!.sendMail(msg),
        30000 // 30s overall timeout
      ) as any;

      if (info && info.rejected && info.rejected.length > 0) {
        throw new ValidationError(`SMTP server synchronously rejected recipients: ${info.rejected.join(', ')}`);
      }

      logger.info(`[LIVE] Email sent successfully to ${to} from ${from.email} via SMTP`);
      return true;
    } catch (error: any) {
      logger.error(`[LIVE] Failed to send email via SMTP to ${to}: ${error.message}`);
      throw error; 
    } finally {
      if (transporter) {
        transporter.close();
      }
    }
  }
}
