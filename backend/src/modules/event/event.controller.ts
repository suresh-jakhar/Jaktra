import { Request, Response, NextFunction } from 'express';
import { EventService } from './event.service.js';

export class EventController {
  constructor(private eventService: EventService) {}

  getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const invoiceId = req.params.id as string;
      const timeline = await this.eventService.listByInvoice(invoiceId, tenantId);
      res.status(200).json(timeline);
    } catch (err: unknown) {
      next(err);
    }
  };

  getFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = res.locals.tenantId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const feed = await this.eventService.getFeed(tenantId, limit);
      res.status(200).json(feed);
    } catch (err: unknown) {
      next(err);
    }
  };
}
