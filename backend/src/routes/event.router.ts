import { Router, Request, Response, RequestHandler } from 'express';
import { EventService, EventError } from '../services/event.service.js';

export function createEventRouter(
  eventService: EventService,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/invoices/:id/timeline',
    authMiddleware,
    tenantScoped,
    async (req: Request, res: Response) => {
      try {
        const tenantId = res.locals.tenantId as string;
        const timeline = await eventService.listByInvoice(req.params.id, tenantId);
        res.status(200).json(timeline);
      } catch (err) {
        if (err instanceof EventError) {
          res.status(err.statusCode).json({ error: err.message });
          return;
        }
        res.status(500).json({ error: 'Internal server error' });
      }
    },
  );

  return router;
}
