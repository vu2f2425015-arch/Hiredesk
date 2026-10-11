import { Router, Request, Response, NextFunction } from 'express';
import {
  DashboardAnalyticsQuerySchema,
  AnalyticsReportQuerySchema,
  UserRole,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AnalyticsService } from '../services/analytics.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const analyticsRouter = Router();

analyticsRouter.use('/analytics', authenticate);

/**
 * GET /api/analytics/dashboard
 * Protected endpoint returning real database-computed dashboard metrics.
 */
analyticsRouter.get('/analytics/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = DashboardAnalyticsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid analytics query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const metrics = await AnalyticsService.getDashboardMetrics(req.user!, parse.data);
    sendSuccess(res, metrics);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/analytics/reports/funnel
 * Pipeline funnel conversion rates across canonical stages.
 */
analyticsRouter.get('/analytics/reports/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyticsReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const report = await AnalyticsService.getFunnelReport(req.user!, parse.data);
    sendSuccess(res, report);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/analytics/reports/time-to-hire
 * Time in stage and time to hire calculated from StageHistory timestamps.
 */
analyticsRouter.get('/analytics/reports/time-to-hire', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyticsReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const report = await AnalyticsService.getTimeToHireReport(req.user!, parse.data);
    sendSuccess(res, report);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/analytics/reports/sources
 * Candidate acquisition source distribution with hiring outcomes.
 */
analyticsRouter.get('/analytics/reports/sources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyticsReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const report = await AnalyticsService.getCandidateSourcesReport(req.user!, parse.data);
    sendSuccess(res, report);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/analytics/reports/productivity
 * Recruiter productivity based on stage actions and interviews.
 * Restricted to super_admin, manager, and recruiter.
 */
analyticsRouter.get(
  '/analytics/reports/productivity',
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = AnalyticsReportQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const report = await AnalyticsService.getRecruiterProductivityReport(req.user!, parse.data);
      sendSuccess(res, report);
    } catch (err: any) {
      if (err.statusCode) {
        sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }
);

analyticsRouter.get(
  '/analytics/reports/recruiter-productivity',
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = AnalyticsReportQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const report = await AnalyticsService.getRecruiterProductivityReport(req.user!, parse.data);
      sendSuccess(res, report);
    } catch (err: any) {
      if (err.statusCode) {
        sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }
);

/**
 * GET /api/analytics/reports/jobs
 * Per-job application and hiring outcomes.
 */
analyticsRouter.get('/analytics/reports/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyticsReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const report = await AnalyticsService.getJobOutcomesReport(req.user!, parse.data);
    sendSuccess(res, report);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

analyticsRouter.get('/analytics/reports/job-outcomes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AnalyticsReportQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid report query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const report = await AnalyticsService.getJobOutcomesReport(req.user!, parse.data);
    sendSuccess(res, report);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});
