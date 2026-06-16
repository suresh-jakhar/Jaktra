import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { loggerStorage } from '../shared/logger.js';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] || crypto.randomUUID()) as string;
  res.setHeader('X-Request-ID', reqId);
  res.locals['requestId'] = reqId;
  loggerStorage.run({ requestId: reqId }, () => {
    next();
  });
}

