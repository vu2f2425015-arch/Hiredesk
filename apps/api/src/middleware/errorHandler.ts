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

  // Handle database connectivity failures (PrismaClientInitializationError / P1001 / connection timeout / ENOTFOUND / paused Supabase)
  const errCode = (err as any).code;
  const errMsg = (err.message || '').toLowerCase();
  const isDbConnectionError =
    err.name === 'PrismaClientInitializationError' ||
    err.name === 'PrismaClientRustPanicError' ||
    errCode === 'P1001' ||
    errCode === 'P1002' ||
    errCode === 'P1008' ||
    errCode === 'P1017' ||
    errMsg.includes("can't reach database server") ||
    errMsg.includes("cant reach database server") ||
    errMsg.includes('database server is running') ||
    errMsg.includes('pooler.supabase.com') ||
    errMsg.includes('tenant') ||
    errMsg.includes('connection timed out') ||
    errMsg.includes('getaddrinfo enotfound');

  if (isDbConnectionError) {
    logger.error(
      {
        requestId,
        err: {
          name: err.name,
          code: errCode,
          message: err.message,
        },
      },
      'Database connectivity error'
    );

    sendError(
      res,
      'DATABASE_UNAVAILABLE',
      'Database server is unreachable. If using Supabase free tier, your project may be paused after a period of inactivity. Please resume your project in the Supabase Dashboard.',
      503
    );
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
