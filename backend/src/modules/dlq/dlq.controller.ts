import { Request, Response } from 'express';
import type { DlqService } from './dlq.service.js';

export class DlqController {
  constructor(private dlqService: DlqService) {}

  getEntries = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const entries = await this.dlqService.getDlqEntries(tenantId);
      res.json(entries);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' });
    }
  };

  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const stats = await this.dlqService.getDlqStats(tenantId);
      res.json(stats);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' });
    }
  };

  deleteEntry = async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const invoice_id = req.params.invoice_id as string;
      await this.dlqService.clearFailure(invoice_id, tenantId);
      res.json({ success: true });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message || 'Internal Server Error' });
    }
  };
}
