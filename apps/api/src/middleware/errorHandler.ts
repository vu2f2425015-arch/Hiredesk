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

  if ((err as any).name === 'MulterError') {
    const multerErr = err as any;
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'FILE_TOO_LARGE', 'File size exceeds the 10 MB limit', 400);
      return;
    }
    sendError(res, 'FILE_UPLOAD_ERROR', multerErr.message, 400);
    return;
  }

  if ((err as any).statusCode) {
    sendError(res, (err as any).code || 'BAD_REQUEST', err.message, (err as any).statusCode);
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
