import { Router } from 'express';
import { DlqController } from './dlq.controller.js';
import { requireRole } from '../../middleware/require-role.js';

export function createDlqRouter(
  dlqController: DlqController,
  authRequired: any,
  tenantScoped: any
): Router {
  const router = Router();

  router.use(authRequired, tenantScoped);

  router.get('/', dlqController.getEntries);
  router.get('/stats', dlqController.getStats);
  router.delete('/:invoice_id', requireRole('admin', 'manager'), dlqController.deleteEntry);

  return router;
}

