import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  PublicApplySchema,
  ApplicationQuerySchema,
  UserRole,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { ApplicationService } from '../services/applications.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const applicationsRouter = Router();

// Configure Multer for in-memory file uploads with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Configure Rate Limiting for Public Submissions
const publicApplyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    sendError(
      res,
      'RATE_LIMIT_EXCEEDED',
      'Too many applications submitted from this IP. Please wait before trying again.',
      429
    );
  },
});

// ============================================================================
// Public Application Submission Endpoint
// ============================================================================

const handlePublicApply = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgSlug, jobCode } = req.params;

    // Early spam trap / honeypot check
    const honeypot = (req.body.honeypot || req.body.website || '').trim();
    if (honeypot.length > 0) {
      sendError(res, 'SPAM_DETECTED', 'Invalid submission detected', 400);
      return;
    }

    // Handle parsed answers if submitted as JSON string in multipart form
    let answers = req.body.answers;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = {};
      }
    }

    const payload = {
      name: typeof req.body.name === 'string' ? req.body.name.trim() : '',
      email: typeof req.body.email === 'string' ? req.body.email.trim() : '',
      phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : undefined,
      answers: answers || {},
    };

    const parse = PublicApplySchema.safeParse(payload);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid application submission', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const result = await ApplicationService.submitPublicApplication(
      orgSlug,
      jobCode,
      parse.data,
      req.file
    );

    sendSuccess(res, result, 201);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
};

/**
 * POST /api/career/:orgSlug/jobs/:jobCode/applications
 * POST /api/career/:orgSlug/jobs/:jobCode/apply
 */
applicationsRouter.post(
  '/career/:orgSlug/jobs/:jobCode/applications',
  publicApplyLimiter,
  upload.single('resume'),
  handlePublicApply
);

applicationsRouter.post(
  '/career/:orgSlug/jobs/:jobCode/apply',
  publicApplyLimiter,
  upload.single('resume'),
  handlePublicApply
);

// ============================================================================
// Authenticated Application Endpoints
// ============================================================================

/**
 * GET /api/jobs/:jobId/applications
 * Lists applications for a job scoped to tenant / assigned client.
 */
applicationsRouter.get(
  '/jobs/:jobId/applications',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;
      const parse = ApplicationQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await ApplicationService.listApplicationsForJob(req.user!, jobId, parse.data);
      sendSuccess(res, result.applications, 200, {
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
 * GET /api/applications/:id
 * Retrieves full application details scoped by authorization.
 */
applicationsRouter.get(
  '/applications/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const application = await ApplicationService.getApplicationById(req.user!, id);
      sendSuccess(res, application);
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
 * GET /api/applications/:id/resume
 * Generates an authorized 60-second signed URL to download candidate resume.
 */
applicationsRouter.get(
  '/applications/:id/resume',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await ApplicationService.getSignedResumeDownloadUrl(req.user!, id);
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
