import { Router, RequestHandler } from 'express';
import { CommunicationController } from './communication.controller.js';
import { requireRole } from '../../middleware/require-role.js';

export function createCommunicationRouter(
  communicationController: CommunicationController,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/invoices/:id/communications',
    authMiddleware,
    tenantScoped,
    communicationController.listByInvoice,
  );

  router.post(
    '/communications',
    authMiddleware,
    tenantScoped,
    requireRole('admin', 'manager'),
    communicationController.create,
  );


  router.get(
    '/settings/:channel',
    authMiddleware,
    tenantScoped,
    communicationController.getSettings,
  );

  router.post(
    '/settings/:channel',
    authMiddleware,
    tenantScoped,
    requireRole('admin'),
    communicationController.updateSettings,
  );

  router.post(
    '/settings/:channel/test',
    authMiddleware,
    tenantScoped,
    requireRole('admin'),
    communicationController.testCommunication,
  );

  return router;
}

