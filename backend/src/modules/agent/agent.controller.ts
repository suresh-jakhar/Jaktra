import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AgentService } from './agent.service.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';

/**
 * Allowed tones for manual override. Maps 1:1 with automatable urgency tiers.
 * `legal_escalation` is intentionally excluded — it has no automated prompt.
 */
const AUTOMATABLE_TONES = [
  'stage_1_warm',
  'stage_2_firm',
  'stage_3_serious',
  'stage_4_stern',
] as const;

const ManualTriggerSchema = z.object({
  tone: z.enum(AUTOMATABLE_TONES).optional(),
});

export class AgentController {
  constructor(private agentService: AgentService) {}

  run = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;

      const parsed = ManualTriggerSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        next(new ValidationError('Invalid tone', JSON.stringify(parsed.error.format())));
        return;
      }

      const run = await this.agentService.triggerRun(tenantId, parsed.data.tone);
      res.status(202).json(run);  // 202 = Accepted, processing in background
    } catch (err: unknown) {
      next(err);
    }
  };

  getRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      
      const runs = await this.agentService.getRuns(tenantId);
      res.status(200).json({ runs, total: runs.length });
    } catch (err: unknown) {
      next(err);
    }
  };

  getRunDetails = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const runId = req.params.id as string;
      
      const run = await this.agentService.getRunDetails(runId, tenantId);
      if (!run) {
        next(new NotFoundError('Agent run not found'));
        return;
      }
      
      res.status(200).json(run);
    } catch (err: unknown) {
      next(err);
    }
  };

  runInvoice = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const tenantId = authReq.user.tenantId;
      const invoiceId = req.params.id as string;

      const parsed = ManualTriggerSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        next(new ValidationError('Invalid tone', JSON.stringify(parsed.error.format())));
        return;
      }

      const result = await this.agentService.triggerSingleInvoice(invoiceId, tenantId, parsed.data.tone);
      res.status(200).json(result);
    } catch (err: unknown) {
      next(err);
    }
  };
}

