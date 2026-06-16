import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { SettingsService } from './settings.service.js';
import { updateSettingsSchema } from './settings.service.js';
import { AuthError, NotFoundError, ValidationError } from '../../shared/errors/index.js';

export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  getSettings = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        next(new AuthError('Tenant ID required', 401));
        return;
      }

      const settings = await this.settingsService.getSettings(tenantId);
      if (!settings) {
        next(new NotFoundError('Settings not found'));
        return;
      }

      res.json(settings);
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        next(new AuthError('Tenant ID required', 401));
        return;
      }

      const parseResult = updateSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        next(new ValidationError('Invalid settings payload', JSON.stringify(parseResult.error.format())));
        return;
      }

      const updated = await this.settingsService.updateSettings(tenantId, parseResult.data);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  getIntegrations = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        next(new AuthError('Tenant ID required', 401));
        return;
      }

      const integrations = await this.settingsService.getIntegrations(tenantId);
      res.json(integrations);
    } catch (error) {
      next(error);
    }
  };

  rotateWebhookToken = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        next(new AuthError('Tenant ID required', 401));
        return;
      }

      const updated = await this.settingsService.rotateWebhookToken(tenantId);
      res.json({ webhookToken: updated.webhookToken });
    } catch (error) {
      next(error);
    }
  };
}
