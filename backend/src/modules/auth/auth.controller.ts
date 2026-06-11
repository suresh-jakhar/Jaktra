import { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from './auth.service.js';
import { AuthError } from '../../shared/errors/index.js';
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


  onboard = async (req: Request, res: Response): Promise<void> => {
    const parsed = onboardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    try {
      const result = await this.authService.onboard(parsed.data);
      res.status(201).json(result);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };
  login = async (req: Request, res: Response): Promise<void> => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
      return;
    }

    try {
      const result = await this.authService.login(parsed.data);
      res.status(200).json(result);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  refresh = async (req: Request, res: Response): Promise<void> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or malformed Authorization header' });
      return;
    }

    try {
      const result = await this.authService.refreshToken(header.slice(7));
      res.status(200).json(result);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const profile = await this.authService.getProfile(userId);
      res.status(200).json(profile);
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      throw err;
    }
  };
}
