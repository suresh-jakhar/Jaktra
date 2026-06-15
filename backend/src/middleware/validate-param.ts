import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateParam(paramName: string, schema: z.ZodSchema = z.string().uuid()) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params[paramName]);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'INVALID_PARAM', message: `Invalid ${paramName} format` }
      });
      return;
    }
    next();
  };
}
