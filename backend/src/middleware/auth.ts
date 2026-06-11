import { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../modules/auth/auth.service.js';
import type { AuthenticatedRequest } from '../shared/types/auth.js';

export function createAuthMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    const token = header.slice(7);

    try {
      (req as AuthenticatedRequest).user = await authService.verifyAndFetchUser(token);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

