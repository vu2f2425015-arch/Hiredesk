import { Router, Request, Response, NextFunction } from 'express';
import { DashboardAnalyticsQuerySchema } from '@hiredesk/shared';
import { authenticate } from '../middleware/auth.js';
import { AnalyticsService } from '../services/analytics.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const analyticsRouter = Router();

/**
 * GET /api/analytics/dashboard
 * Protected endpoint returning real database-computed dashboard metrics.
 */
analyticsRouter.get(
  '/analytics/dashboard',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = DashboardAnalyticsQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid analytics query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const metrics = await AnalyticsService.getDashboardMetrics(req.user!, parse.data);
      sendSuccess(res, metrics);
    } catch (err) {
      next(err);
    }
  }
);
