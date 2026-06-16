import { Request, Response, NextFunction } from 'express';
import {
  CommunicationService,
  createCommunicationSchema,
} from './communication.service.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';
import { z } from 'zod';
import { ValidationError } from '../../shared/errors/index.js';

const SettingsSchema = z.object({
  senderName: z.string().min(1),
  senderEmail: z.string().email(),
  replyTo: z.string().email().optional(),
  idempotencyWindowHours: z.number().int().min(0).optional().default(20),
});

const TestMessageSchema = z.object({
  to: z.string().email(),
});

export class CommunicationController {
  constructor(private communicationService: CommunicationService) {}

  listByInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const invoiceId = req.params.id as string;
      const records = await this.communicationService.listByInvoice(invoiceId, tenantId);
      res.status(200).json(records);
    } catch (err: unknown) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = createCommunicationSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError('Validation failed', JSON.stringify(parsed.error.format())));
      return;
    }

    try {
      const tenantId = res.locals.tenantId as string;
      const comm = await this.communicationService.create(parsed.data, tenantId);
      res.status(201).json(comm);
    } catch (err: unknown) {
      next(err);
    }
  };

  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const settings = await this.communicationService.getSettings(tenantId);
      res.status(200).json(settings || {});
    } catch (err: unknown) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const parsed = SettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError('Validation failed', JSON.stringify(parsed.error.format())));
        return;
      }

      const { senderName, senderEmail, replyTo, idempotencyWindowHours } = parsed.data;
      const settings = await this.communicationService.updateSettings(tenantId, senderName, senderEmail, replyTo, idempotencyWindowHours);
      res.status(200).json(settings);
    } catch (err: unknown) {
      next(err);
    }
  };

  testCommunication = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;

      const parsed = TestMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        next(new ValidationError('Validation failed', JSON.stringify(parsed.error.format())));
        return;
      }

      const { to } = parsed.data;

      await this.communicationService.send({
        tenantId,
        to,
        subject: '[Test] CreditOps Communication Configuration',
        html: '<p>This is a test message to verify your configuration is working successfully.</p>',
        channel: 'email'
      });

      res.status(200).json({ success: true, message: `Test message sent successfully` });
    } catch (err: unknown) {
      next(err);
    }
  };
}
