import { Router } from 'express';
import { AgentController } from './agent.controller.js';
import { requireRole } from '../../middleware/require-role.js';

export function createAgentRouter(
  agentController: AgentController,
  authRequired: any,
  tenantScoped: any
): Router {
  const router = Router();

  router.use(authRequired, tenantScoped);

  // POST /api/agent/run
  router.post('/run', requireRole('admin', 'manager'), agentController.run);

  // GET /api/agent/runs
  router.get('/runs', agentController.getRuns);

  // GET /api/agent/runs/:id
  router.get('/runs/:id', agentController.getRunDetails);

  // POST /api/agent/run/invoice/:id
  router.post('/run/invoice/:id', requireRole('admin', 'manager'), agentController.runInvoice);

  return router;
}

