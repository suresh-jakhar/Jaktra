import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import * as Sentry from '@sentry/node';
import { AppError } from '../shared/errors/index.js';
import { logger } from '../shared/logger.js';
import { mapErrorToDisplayMessage } from '../shared/utils/error-mapper.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = res.locals.requestId || 'unknown';

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let displayMessage = 'An unexpected error occurred';
  let technicalMessage = err.message || 'An unexpected error occurred';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    displayMessage = err.displayMessage;
    technicalMessage = err.technicalMessage;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    displayMessage = 'Invalid request data';
    technicalMessage = JSON.stringify(err.issues);
  } else {
    // Check if it's database, network, axios, etc.
    const errString = String(err);
    const errMsg = err.message || errString;
    displayMessage = mapErrorToDisplayMessage(err);

    if (errMsg.includes('unique constraint') || errMsg.includes('23505') || errMsg.includes('unique violation') || errMsg.includes('already exists')) {
      statusCode = 409;
      errorCode = 'CONFLICT';
    } else if (errMsg.includes('not found') || errMsg.includes('NotFoundError')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (
      errMsg.includes('ECONNREFUSED') || 
      errMsg.includes('fetch failed') || 
      errMsg.includes('ETIMEDOUT') || 
      errMsg.includes('AxiosError')
    ) {
      statusCode = 502;
      errorCode = 'EXTERNAL_SERVICE_ERROR';
    }
  }

  // Developer logging (server logs)
  logger.error(`[Error] Request ID: ${requestId} | Code: ${errorCode} | Technical Message: ${technicalMessage} | Path: ${req.method} ${req.path}`, {
    stackTrace: err.stack,
  });

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, {
      tags: { requestId, errorCode }
    });
  }

  const errorResponse: any = {
    error: {
      code: errorCode,
      message: displayMessage,
      requestId,
    }
  };

  // Dev only — never in production
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.error.details = technicalMessage;
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}
