import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      event: 'request_completed',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    });
  });
  
  next();
}
