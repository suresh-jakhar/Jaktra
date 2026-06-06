import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AgentService } from '../services/agent.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const RunBatchSchema = z.object({
  dryRun: z.boolean().optional(),
});

export function createAgentRouter(
  agentService: AgentService,
  authRequired: any,
  tenantScoped: any
): Router {
  const router = Router();

  router.use(authRequired, tenantScoped);

  // POST /api/agent/run
  router.post('/run', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const parsed = RunBatchSchema.safeParse(req.body);
      
      const dryRun = parsed.success ? parsed.data.dryRun : false;

      // In a real production system this would run asynchronously via a queue,
      // but to satisfy A14 requirements simply, we'll await or run in background.
      // We will await to return the final status for simplicity of this phase.
      const run = await agentService.triggerRun(tenantId, dryRun);
      res.status(200).json(run);
    } catch (err) {
      res.status(500).json({
        error: {
          code: 'AGENT_RUN_ERROR',
          message: 'Failed to trigger agent run',
          details: String(err),
        },
      });
    }
  });

  // GET /api/agent/runs
  router.get('/runs', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const runs = await agentService.getRuns(tenantId);
      res.status(200).json({ runs, total: runs.length });
    } catch (err) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agent runs',
          details: String(err),
        },
      });
    }
  });

  // GET /api/agent/runs/:id
  router.get('/runs/:id', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const runId = req.params.id as string;
      
      const run = await agentService.getRunDetails(runId, tenantId);
      if (!run) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Agent run not found',
          },
        });
      }
      
      res.status(200).json(run);
    } catch (err) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agent run',
          details: String(err),
        },
      });
    }
  });

  // POST /api/agent/run/invoice/:id
  router.post('/run/invoice/:id', async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const invoiceId = req.params.id as string;
      
      const result = await agentService.triggerSingleInvoice(invoiceId, tenantId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'Invoice not found') {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Invoice not found or not actionable' }
        });
      }
      res.status(500).json({
        error: {
          code: 'SINGLE_RUN_ERROR',
          message: 'Failed to run agent on invoice',
          details: String(err),
        },
      });
    }
  });

  return router;
}
