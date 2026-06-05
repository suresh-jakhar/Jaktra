import { Router, Request, Response, RequestHandler } from 'express';
import type { AimlService } from '../services/aiml.service.js';

export function createAimlRouter(
  aimlService: AimlService,
  authMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.get(
    '/health',
    authMiddleware,
    async (_req: Request, res: Response) => {
      const status = await aimlService.getAgentStatus();
      const httpCode = status.status === 'ok' ? 200 : 503;
      res.status(httpCode).json(status);
    },
  );

  return router;
}
