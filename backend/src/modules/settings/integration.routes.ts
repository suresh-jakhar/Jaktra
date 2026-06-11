import { Router } from 'express';
import { IntegrationController } from './integration.controller.js';
import { tenantScoped } from '../../middleware/tenant-scoped.js';

import { requireRole } from '../../middleware/require-role.js';

export function createIntegrationRouter(controller: IntegrationController): Router {
  const router = Router();

  // Authentication is assumed to be handled before this router is mounted
  router.use(tenantScoped);

  router.get('/', controller.getStatus);
  
  router.post('/sendgrid', requireRole('admin'), controller.saveSendgridKey);
  router.post('/sendgrid/test', requireRole('admin'), controller.testSendgridKey);
  router.delete('/sendgrid', requireRole('admin'), controller.disconnectSendgrid);

  router.post('/smtp', requireRole('admin'), controller.saveSmtpConfig);
  router.post('/smtp/test', requireRole('admin'), controller.testSmtpConfig);
  router.delete('/smtp', requireRole('admin'), controller.disconnectSmtp);

  router.patch('/default-provider', requireRole('admin'), controller.setDefaultProvider);

  return router;
}
