import { Router, RequestHandler } from 'express';
import { SettingsController } from './settings.controller.js';
import { requireRole } from '../../middleware/require-role.js';

export function createSettingsRouter(
  settingsController: SettingsController,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler
): Router {
  const router = Router();

  router.use(authMiddleware, tenantScoped);

  router.get('/', settingsController.getSettings);
  router.patch('/', requireRole('admin'), settingsController.updateSettings);

  return router;
}
