import { Response, NextFunction } from 'express';
import type { AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from '../types/auth.js';

// Factory so the middleware receives AuthService via injection, not a global import
export function createAuthMiddleware(authService: AuthService) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    const token = header.slice(7);

    try {
      req.user = authService.verifyToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
