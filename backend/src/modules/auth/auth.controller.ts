import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AuthService } from './auth.service.js';
import { AuthError, ValidationError } from '../../shared/errors/index.js';
import type { AuthenticatedRequest } from '../../shared/types/auth.js';


const onboardSchema = z.object({
  name: z.string().min(1),
  companyName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  constructor(private authService: AuthService) {}


  onboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = onboardSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError('Validation failed', JSON.stringify(parsed.error.issues)));
      return;
    }

    try {
      const result = await this.authService.onboard(parsed.data);
      res.status(201).json(result);
    } catch (err: unknown) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(new ValidationError('Validation failed', JSON.stringify(parsed.error.issues)));
      return;
    }

    try {
      const result = await this.authService.login(parsed.data);
      res.status(200).json(result);
    } catch (err: unknown) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(new AuthError('Missing or malformed Authorization header', 401));
      return;
    }

    try {
      const result = await this.authService.refreshToken(header.slice(7));
      res.status(200).json(result);
    } catch (err: unknown) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const profile = await this.authService.getProfile(userId);
      res.status(200).json(profile);
    } catch (err: unknown) {
      next(err);
    }
  };
}

