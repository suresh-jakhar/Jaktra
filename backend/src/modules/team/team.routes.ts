import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { TeamController } from './team.controller.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';

export function createTeamRouter(
  teamController: TeamController,
  authMiddleware: RequestHandler
): Router {
  const router = Router();

  const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Requires admin role' });
      return;
    }
    next();
  };

  const requireManagerOrAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (user.role !== 'admin' && user.role !== 'manager') {
      res.status(403).json({ error: 'Requires manager or admin role' });
      return;
    }
    next();
  };

  const inviteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10,
    message: { error: 'Too many invitations sent from this IP, please try again after 15 minutes' }
  });

  const acceptLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 5,
    message: { error: 'Too many acceptance attempts from this IP, please try again after an hour' }
  });

  router.post('/accept-invitation', acceptLimiter, teamController.acceptInvitation);

  router.use(authMiddleware);

  router.get('/members', requireManagerOrAdmin, teamController.listMembers);
  router.get('/invitations', requireManagerOrAdmin, teamController.listInvitations);

  router.post('/invitations', requireAdmin, inviteLimiter, teamController.inviteMember);
  router.post('/invitations/:id/resend', requireAdmin, inviteLimiter, teamController.resendInvitation);
  router.delete('/invitations/:id', requireAdmin, teamController.revokeInvitation);
  
  router.put('/members/:id/role', requireAdmin, teamController.updateMemberRole);
  router.delete('/members/:id', requireAdmin, teamController.removeMember);

  return router;
}
