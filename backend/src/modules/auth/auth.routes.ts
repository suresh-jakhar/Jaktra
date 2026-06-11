import { Router, RequestHandler } from 'express';
import { AuthController } from './auth.controller.js';

export function createAuthRouter(
  authController: AuthController,
  authMiddleware: RequestHandler,
): Router {
  const router = Router();

  router.post('/onboard', authController.onboard);
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);
  router.get('/me', authMiddleware, authController.getMe);

  return router;
}

