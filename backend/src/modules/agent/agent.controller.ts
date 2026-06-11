import { Request, Response } from 'express';
import { z } from 'zod';
import type { AgentService } from './agent.service.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';



export class AgentController {
  constructor(private agentService: AgentService) {}

  run = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const run = await this.agentService.triggerRun(tenantId);
      res.status(200).json(run);
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: 'AGENT_RUN_ERROR',
          message: 'Failed to trigger agent run',
          details: String(err),
        },
      });
    }
  };

  getRuns = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const runs = await this.agentService.getRuns(tenantId);
      res.status(200).json({ runs, total: runs.length });
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agent runs',
          details: String(err),
        },
      });
    }
  };

  getRunDetails = async (req: Request, res: Response): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const runId = req.params.id as string;
      
      const run = await this.agentService.getRunDetails(runId, tenantId);
      if (!run) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Agent run not found',
          },
        });
      }
      
      res.status(200).json(run);
    } catch (err: unknown) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch agent run',
          details: String(err),
        },
      });
    }
  };

  runInvoice = async (req: Request, res: Response): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const invoiceId = req.params.id as string;
      
      const result = await this.agentService.triggerSingleInvoice(invoiceId, tenantId);
      res.status(200).json(result);
    } catch (err: unknown) {
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
  };
}
