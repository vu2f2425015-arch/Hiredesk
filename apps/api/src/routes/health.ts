import { Router, Request, Response } from 'express';
import { sendSuccess } from '../utils/response.js';
import { config } from '../config/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (req: Request, res: Response) => {
  const healthData = {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'hiredesk-api',
    version: '0.1.0',
    environment: config.NODE_ENV,
  };

  sendSuccess(res, healthData, 200);
});
