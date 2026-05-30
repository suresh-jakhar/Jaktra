/**
 * health.router.ts
 *
 * Single Responsibility: expose the health-check endpoint only.
 * Open/Closed: adding new diagnostic fields does not require modifying this
 *   router — extend the HealthResponse type and add to the handler.
 */

import { Router, Request, Response } from 'express';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
}

const healthRouter: Router = Router();

/**
 * GET /api/health
 * Returns a 200 with service metadata. Used by load-balancers, monitoring
 * tools, and A13's AI-ML bridge health check.
 */
healthRouter.get('/', (_req: Request, res: Response<HealthResponse>) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] ?? 'development',
  };

  res.status(200).json(response);
});

export default healthRouter;
