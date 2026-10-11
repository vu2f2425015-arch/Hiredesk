import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { bootstrapRouter } from './routes/bootstrap.js';
import { adminRouter } from './routes/admin.js';
import { jobsRouter } from './routes/jobs.js';
import { applicationsRouter } from './routes/applications.js';
import { inboundRouter } from './routes/inbound.js';
import { analyticsRouter } from './routes/analytics.js';
import { clientPortalRouter } from './routes/clientPortal.js';
import { interviewsRouter } from './routes/interviews.js';
import { sendError } from './utils/response.js';

export function createApp(): Express {
  const app = express();

  // Standard Security & Utility Middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(requestIdMiddleware);

  // Request Logging
  if (config.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
      })
    );
  }

  // Mount Routes
  app.use(healthRouter);
  app.use('/api', healthRouter);
  app.use('/api', meRouter);
  app.use('/api', bootstrapRouter);
  app.use('/api', adminRouter);
  app.use('/api', jobsRouter);
  app.use('/api', applicationsRouter);
  app.use('/api', inboundRouter);
  app.use('/api', analyticsRouter);
  app.use('/api', clientPortalRouter);
  app.use('/api', interviewsRouter);


  // Fallthrough 404 handler
  app.use((req: Request, res: Response) => {
    sendError(res, 'NOT_FOUND', `Cannot ${req.method} ${req.path}`, 404);
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
}
