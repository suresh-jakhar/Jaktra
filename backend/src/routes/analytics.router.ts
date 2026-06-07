import { Router, Request, Response, RequestHandler } from 'express';
import { AnalyticsService, DateRangeSchema } from '../services/analytics.service.js';

export function createAnalyticsRouter(
  analyticsService: AnalyticsService,
  authMiddleware: RequestHandler,
  tenantScoped: RequestHandler,
): Router {
  const router = Router();

  router.use(authMiddleware, tenantScoped);

  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getSummary(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/aging', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getAging(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/dso', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getDso(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/collection-rate', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getCollectionRate(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/agent/performance', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getAgentPerformance(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/agent/channel-breakdown', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getChannelBreakdown(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/agent/tier-effectiveness', async (req: Request, res: Response) => {
    try {
      const query = DateRangeSchema.parse(req.query);
      const tenantId = res.locals.tenantId as string;
      const data = await analyticsService.getTierEffectiveness(tenantId, query);
      res.json(data);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
