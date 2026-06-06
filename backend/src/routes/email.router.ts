import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { EmailService } from '../services/email.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const EmailSettingsSchema = z.object({
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  replyTo: z.string().email().optional(),
});

const TestEmailSchema = z.object({
  to: z.string().email(),
  mode: z.enum(['live', 'dry_run']).optional().default('dry_run'),
});

export function createEmailRouter(
  emailService: EmailService,
  authRequired: any,
  tenantScoped: any
): Router {
  const router = Router();

  router.use(authRequired, tenantScoped);

  // GET /api/settings/email
  router.get('/', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const settings = await emailService.getSettings(tenantId);
      res.status(200).json(settings || {});
    } catch (err) {
      res.status(500).json({ error: { message: 'Failed to fetch email settings' } });
    }
  });

  // POST /api/settings/email
  router.post('/', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const parsed = EmailSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { senderName, senderEmail, replyTo } = parsed.data;
      const settings = await emailService.updateSettings(tenantId, senderName, senderEmail, replyTo);
      res.status(200).json(settings);
    } catch (err) {
      res.status(500).json({ error: { message: 'Failed to update email settings' } });
    }
  });

  // POST /api/settings/email/test
  router.post('/test', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;

      const parsed = TestEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }

      const { to, mode } = parsed.data;

      await emailService.sendEmail({
        tenantId,
        to,
        subject: '[Test] CreditOps Email Configuration',
        html: '<p>This is a test email to verify your configuration is working successfully.</p>',
        mode,
      });

      res.status(200).json({ success: true, message: `Test email sent successfully in ${mode} mode` });
    } catch (err: any) {
      res.status(500).json({ error: { message: err.message || 'Failed to send test email' } });
    }
  });

  return router;
}
