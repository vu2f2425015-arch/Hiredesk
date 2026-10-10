import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'Validation error');
    sendError(res, 'VALIDATION_ERROR', 'Input validation failed', 400, err.flatten().fieldErrors);
    return;
  }

  logger.error(
    {
      requestId,
      err: {
        message: err.message,
        stack: config.NODE_ENV !== 'production' ? err.stack : undefined,
      },
    },
    'Unhandled server error'
  );

  sendError(
    res,
    'INTERNAL_SERVER_ERROR',
    config.NODE_ENV === 'production' ? 'An unexpected internal error occurred' : err.message,
    500
  );
}
