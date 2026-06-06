import { Router, Request, Response, RequestHandler } from 'express';
import {
  CommunicationService,
  CommunicationError,
  createCommunicationSchema,
} from '../services/communication.service.js';

export function createCommunicationRouter(
  communicationService: CommunicationService,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/invoices/:id/communications',
    authMiddleware,
    tenantScoped,
    async (req: Request, res: Response) => {
      try {
        const tenantId = res.locals.tenantId as string;
        const invoiceId = req.params.id as string;
        const records = await communicationService.listByInvoice(invoiceId, tenantId);
        res.status(200).json(records);
      } catch (err) {
        if (err instanceof CommunicationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  router.post(
    '/communications',
    authMiddleware,
    tenantScoped,
    async (req: Request, res: Response) => {
      const parsed = createCommunicationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
        return;
      }

      try {
        const tenantId = res.locals.tenantId as string;
        const record = await communicationService.create(parsed.data, tenantId);
        res.status(201).json(record);
      } catch (err) {
        if (err instanceof CommunicationError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  return router;
}
