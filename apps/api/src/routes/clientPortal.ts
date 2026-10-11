import { Router, Request, Response, NextFunction } from 'express';
import {
  UserRole,
  ClientPortalJobQuerySchema,
  ClientPortalApplicationQuerySchema,
  ClientPortalShortlistSchema,
  ClientPortalRejectSchema,
  ClientPortalRequestInterviewSchema,
  ClientPortalFeedbackSchema,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ClientPortalService } from '../services/clientPortal.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const clientPortalRouter = Router();

// ============================================================================
// Client Portal Authentication & Scoping Endpoints
// ============================================================================

/**
 * GET /api/client-portal/me
 * Authenticated client context with company profile and zero secrets.
 */
clientPortalRouter.get(
  '/client-portal/me',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await ClientPortalService.getClientProfile(req.user!);
      sendSuccess(res, data);
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
 * GET /api/client-portal/jobs
 * Lists assigned published jobs for current client's assigned clientId and organization.
 */
clientPortalRouter.get(
  '/client-portal/jobs',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = ClientPortalJobQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await ClientPortalService.listAssignedJobs(req.user!, parse.data);
      sendSuccess(res, result.jobs, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
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
 * GET /api/client-portal/jobs/:jobId/applications
 * Lists applications strictly for the verified client's assigned job.
 */
clientPortalRouter.get(
  '/client-portal/jobs/:jobId/applications',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const parse = ClientPortalApplicationQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await ClientPortalService.listApplicationsForJob(req.user!, jobId, parse.data);
      sendSuccess(res, result.applications, 200, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        job: result.job,
      });
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
 * GET /api/client-portal/applications/:applicationId
 * Retrieves client-safe candidate/application review profile.
 */
clientPortalRouter.get(
  '/client-portal/applications/:applicationId',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const app = await ClientPortalService.getApplicationById(req.user!, applicationId);
      sendSuccess(res, app);
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
 * GET /api/client-portal/applications/:applicationId/resume
 * Generates an authorized 60-second signed URL for client resume download.
 */
clientPortalRouter.get(
  '/client-portal/applications/:applicationId/resume',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const result = await ClientPortalService.getSignedResumeUrl(req.user!, applicationId);
      sendSuccess(res, result);
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
 * POST /api/client-portal/applications/:applicationId/shortlist
 * Client review action: shortlists candidate if permitted by review policy.
 */
clientPortalRouter.post(
  '/client-portal/applications/:applicationId/shortlist',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const parse = ClientPortalShortlistSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid shortlist payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await ClientPortalService.shortlistCandidate(req.user!, applicationId, parse.data);
      sendSuccess(res, updated);
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
 * POST /api/client-portal/applications/:applicationId/reject
 * Client review action: rejects candidate with required reason.
 */
clientPortalRouter.post(
  '/client-portal/applications/:applicationId/reject',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const parse = ClientPortalRejectSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid rejection payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await ClientPortalService.rejectCandidate(req.user!, applicationId, parse.data);
      sendSuccess(res, updated);
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
 * POST /api/client-portal/applications/:applicationId/request-interview
 * Records a persisted, auditable interview request record with status 'pending'.
 * Note: Does not claim calendar event or email sent unless full integration exists.
 */
clientPortalRouter.post(
  '/client-portal/applications/:applicationId/request-interview',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const parse = ClientPortalRequestInterviewSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid interview request payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await ClientPortalService.requestInterview(req.user!, applicationId, parse.data);
      sendSuccess(res, result, 201);
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
 * POST /api/client-portal/applications/:applicationId/feedback
 * Adds client-visible review feedback.
 */
clientPortalRouter.post(
  '/client-portal/applications/:applicationId/feedback',
  authenticate,
  requireRole(UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = req.params;
      const parse = ClientPortalFeedbackSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid feedback payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await ClientPortalService.submitFeedback(req.user!, applicationId, parse.data);
      sendSuccess(res, updated);
    } catch (err: any) {
      if (err.statusCode) {
        sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }
);
