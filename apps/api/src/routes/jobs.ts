import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateJobSchema,
  UpdateJobSchema,
  JobQuerySchema,
  JobStatus,
  UserRole,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { JobService } from '../services/jobs.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const jobsRouter = Router();

// ============================================================================
// Public Career Endpoints (No Authentication Required)
// ============================================================================

jobsRouter.get('/career/:orgSlug/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgSlug } = req.params;
    const result = await JobService.getPublicCareerJobs(orgSlug);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode === 404) {
      sendError(res, 'NOT_FOUND', err.message, 404);
      return;
    }
    next(err);
  }
});

jobsRouter.get('/career/:orgSlug/jobs/:jobCode', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgSlug, jobCode } = req.params;
    const job = await JobService.getPublicCareerJobByCode(orgSlug, jobCode);
    sendSuccess(res, job);
  } catch (err: any) {
    if (err.statusCode === 404) {
      sendError(res, 'NOT_FOUND', err.message, 404);
      return;
    }
    next(err);
  }
});

// ============================================================================
// Authenticated Recruitment Job Endpoints
// ============================================================================

/**
 * POST /api/jobs
 * Creates a job within the recruiter's organization and allocates an atomic Job Code.
 */
jobsRouter.post(
  '/jobs',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = CreateJobSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid job payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const created = await JobService.createJob(req.user!, parse.data);
      sendSuccess(res, created, 201);
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
 * GET /api/jobs
 * Lists jobs scoped by tenant and caller role with search, status filters, and pagination.
 */
jobsRouter.get('/jobs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = JobQuerySchema.safeParse(req.query);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const result = await JobService.listJobs(req.user!, parse.data);
    sendSuccess(res, result.jobs, 200, {
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jobs/:id
 * Retrieves job details enforcing organization and client scope.
 */
jobsRouter.get('/jobs/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await JobService.getJobById(req.user!, req.params.id);
    sendSuccess(res, job);
  } catch (err: any) {
    if (err.statusCode === 404) {
      sendError(res, 'NOT_FOUND', err.message, 404);
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/jobs/:id
 * Updates permitted job fields while strictly protecting jobCode and organization ownership.
 */
jobsRouter.patch(
  '/jobs/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = UpdateJobSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid job update payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await JobService.updateJob(req.user!, req.params.id, parse.data);
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
 * POST /api/jobs/:id/publish
 */
jobsRouter.post(
  '/jobs/:id/publish',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await JobService.updateJobStatus(req.user!, req.params.id, JobStatus.PUBLISHED);
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
 * POST /api/jobs/:id/close
 */
jobsRouter.post(
  '/jobs/:id/close',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await JobService.updateJobStatus(req.user!, req.params.id, JobStatus.CLOSED);
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
 * POST /api/jobs/:id/reopen
 */
jobsRouter.post(
  '/jobs/:id/reopen',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await JobService.updateJobStatus(req.user!, req.params.id, JobStatus.PUBLISHED);
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
 * POST /api/jobs/:id/duplicate
 * Duplicates a job with a brand new atomic Job Code.
 */
jobsRouter.post(
  '/jobs/:id/duplicate',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const duplicated = await JobService.duplicateJob(req.user!, req.params.id);
      sendSuccess(res, duplicated, 201);
    } catch (err: any) {
      if (err.statusCode) {
        sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }
);
