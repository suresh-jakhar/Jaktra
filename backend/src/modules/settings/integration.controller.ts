import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from './integration.service.js';
import { CommunicationService } from '../communication/communication.service.js';

export class IntegrationController {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly communicationService: CommunicationService
  ) {}

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const [sendgridStatus, smtpStatus] = await Promise.all([
        this.integrationService.getIntegrationStatus(tenantId, 'sendgrid'),
        this.integrationService.getIntegrationStatus(tenantId, 'smtp')
      ]);
      res.set('Cache-Control', 'no-store');
      res.json({
        sendgrid: sendgridStatus,
        smtp: smtpStatus
      });
    } catch (error) {
      next(error);
    }
  };

  saveSendgridKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string' || apiKey.length > 200) {
        return res.status(400).json({ error: 'Invalid API Key format' });
      }

      await this.integrationService.validateAndSaveSendgridKey(tenantId, apiKey);
      
      res.json({ message: 'SendGrid integration saved successfully' });
    } catch (error) {
      next(error);
    }
  };

  testSendgridKey = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { to } = req.body;

      if (!to || typeof to !== 'string') {
        return res.status(400).json({ error: 'Valid recipient email required' });
      }

      await this.communicationService.testConnection(tenantId, to);

      res.json({ message: 'Test email accepted for delivery' });
    } catch (error) {
      next(error);
    }
  };

  disconnectSendgrid = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      await this.integrationService.deleteSendgridIntegration(tenantId);
      
      const settings = await this.communicationService.getSettings(tenantId);
      if (settings && (settings as any).defaultEmailProvider === 'sendgrid') {
         await this.communicationService.setDefaultEmailProvider(tenantId, null);
      }
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  saveSmtpConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      
      const bodyStr = JSON.stringify(req.body);
      if (bodyStr.length > 5000) {
        return res.status(400).json({ error: 'Request body too large' });
      }

      await this.integrationService.validateAndSaveSmtpConfig(tenantId, req.body);
      
      res.json({ message: 'SMTP connection verified and saved successfully' });
    } catch (error) {
      next(error);
    }
  };

  testSmtpConfig = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { to } = req.body;

      if (!to || typeof to !== 'string') {
        return res.status(400).json({ error: 'Valid recipient email required' });
      }


      const config = await this.integrationService.getDecryptedSmtpConfig(tenantId);
      const { SmtpProvider } = await import('../communication/providers/smtp.provider.js');
      const provider = new SmtpProvider(config);
      const settings = await this.communicationService.getSettings(tenantId);
      
      if (!settings || !settings.senderEmail) {
        return res.status(400).json({ error: 'Communication settings (Sender Email) not configured' });
      }

      const from = { name: settings.senderName, email: settings.senderEmail };
      const replyTo = settings.replyTo ? { email: settings.replyTo } : undefined;

      await provider.sendEmail(
        to,
        from,
        replyTo,
        'Integration Test',
        '<p>Your SMTP integration is working correctly.</p>'
      );

      res.json({ message: 'Test email accepted by SMTP server' });
    } catch (error) {
      next(error);
    }
  };

  disconnectSmtp = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      await this.integrationService.deleteSmtpIntegration(tenantId);
      
      const settings = await this.communicationService.getSettings(tenantId);
      if (settings && (settings as any).defaultEmailProvider === 'smtp') {
         await this.communicationService.setDefaultEmailProvider(tenantId, null);
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  setDefaultProvider = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenantId;
      const { provider } = req.body;

      if (provider !== 'sendgrid' && provider !== 'smtp' && provider !== null) {
         return res.status(400).json({ error: 'Invalid provider' });
      }

      if (provider) {
        const status = await this.integrationService.getIntegrationStatus(tenantId, provider);
        if (!status || !status.isConfigured || status.lastValidationResult !== 'valid') {
           return res.status(400).json({ error: 'Cannot select an absent or invalid provider' });
        }
      }

      await this.communicationService.setDefaultEmailProvider(tenantId, provider);
      res.json({ message: 'Default provider updated' });
    } catch (error) {
      next(error);
    }
  };
}
