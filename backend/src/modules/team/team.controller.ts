import { Request, Response } from 'express';
import { z } from 'zod';
import type { TeamService } from './team.service.js';
import type { TeamRepository } from './team.repository.js';
import { AuthError } from '../../shared/errors/index.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'manager', 'viewer']),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'manager', 'viewer']),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1).max(255),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
});

const sanitizeInvitation = (inv: any) => {
  const { tokenHash, deliveryError, ...safe } = inv;
  return safe;
};

export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly teamRepo: TeamRepository
  ) {}

  listMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const members = await this.teamRepo.listActiveMembers(tenantId);
      res.status(200).json(members.map(m => {
        const { passwordHash, ...safe } = m;
        return safe;
      }));
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  listInvitations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const invites = await this.teamRepo.listPendingInvitations(tenantId);
      res.status(200).json(invites.map(sanitizeInvitation));
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  inviteMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId, userId } = (req as AuthenticatedRequest).user;
      const parsed = inviteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const invite = await this.teamService.inviteMember(tenantId, userId, parsed.data);
      res.status(201).json(sanitizeInvitation(invite));
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  resendInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const inviteId = req.params.id as string;
      const invite = await this.teamService.resendInvitation(tenantId, inviteId);
      res.status(200).json(sanitizeInvitation(invite));
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  revokeInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const inviteId = req.params.id as string;
      await this.teamService.revokeInvitation(tenantId, inviteId);
      res.status(204).send();
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const memberId = req.params.id as string;
      await this.teamService.removeMember(tenantId, memberId, ((req as AuthenticatedRequest).user as any).userId || ((req as AuthenticatedRequest).user as any).sub || 'unknown');
      res.status(204).send();
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  updateMemberRole = async (req: Request, res: Response): Promise<void> => {
    try {
      const { tenantId } = (req as AuthenticatedRequest).user;
      const memberId = req.params.id as string;
      const parsed = updateRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      await this.teamService.updateMemberRole(tenantId, memberId, parsed.data.role as 'admin' | 'manager' | 'viewer');
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = acceptInviteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      await this.teamService.acceptInvitation(parsed.data.token, parsed.data.password, parsed.data.name);
      res.status(200).json({ success: true });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };
}
