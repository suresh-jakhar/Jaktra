import { Router } from 'express';
import { DlqService } from '../services/dlq.service.js';

export function createDlqRouter(
  dlqService: DlqService,
  authRequired: any,
  tenantScoped: any
): Router {
  const router = Router();

  router.use(authRequired, tenantScoped);

  router.get('/', async (req, res) => {
    try {
      const entries = await dlqService.getDlqEntries();
      res.json(entries);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  router.get('/stats', async (req, res) => {
    try {
      const stats = await dlqService.getDlqStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  router.delete('/:invoice_id', async (req, res) => {
    try {
      const { invoice_id } = req.params;
      await dlqService.clearFailure(invoice_id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  });

  return router;
}
