import { Router, Request, Response, RequestHandler } from 'express';
import { SettingsService, updateSettingsSchema } from '../services/settings.service.js';

export function createSettingsRouter(
  settingsService: SettingsService,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler
): Router {
  const router = Router();

  router.use(authMiddleware, tenantScoped);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        return res.status(401).json({ error: { code: 'AuthError', message: 'Tenant ID required' } });
      }

      const settings = await settingsService.getSettings(tenantId);
      if (!settings) {
        return res.status(404).json({ error: { code: 'NotFoundError', message: 'Settings not found' } });
      }

      res.json(settings);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  router.patch('/', async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        return res.status(401).json({ error: { code: 'AuthError', message: 'Tenant ID required' } });
      }

      const parseResult = updateSettingsSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'ValidationError',
            message: 'Invalid settings payload',
            details: parseResult.error.format(),
          },
        });
      }

      const updated = await settingsService.updateSettings(tenantId, parseResult.data);
      res.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  router.get('/integrations', async (req: Request, res: Response) => {
    try {
      const tenantId = res.locals.tenantId as string;
      if (!tenantId) {
        return res.status(401).json({ error: { code: 'AuthError', message: 'Tenant ID required' } });
      }

      const integrations = await settingsService.getIntegrations(tenantId);
      res.json(integrations);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
