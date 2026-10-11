import { Router, Request, Response, NextFunction } from 'express';
import {
  UserRole,
  InterviewQuerySchema,
  ScheduleInterviewSchema,
  RescheduleInterviewSchema,
  CancelInterviewSchema,
  CompleteInterviewSchema,
  RecordNoShowSchema,
  UpdateFeedbackSchema,
  InterviewRequestStatus,
} from '@hiredesk/shared';
import { prisma } from '@hiredesk/database';
import { authenticate, requireRole } from '../middleware/auth.js';
import { InterviewService } from '../services/interviews.js';
import { EmailService } from '../services/email.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const interviewsRouter = Router();

const recruiterRoles = [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER];

/**
 * GET /api/interviews
 * List interviews with tenant scoping and filters
 */
interviewsRouter.get(
  '/interviews',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = InterviewQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await InterviewService.listInterviews(req.user!, parse.data);
      sendSuccess(res, result.interviews, 200, {
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
 * GET /api/interviews/metadata/interviewers
 * Lists available interviewers/recruiters in caller's organization
 */
interviewsRouter.get(
  '/interviews/metadata/interviewers',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const interviewers = await prisma.userProfile.findMany({
        where: {
          organizationId: req.user!.organizationId!,
          isActive: true,
          role: { in: [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
        },
        select: {
          id: true,
          fullName: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
        orderBy: { firstName: 'asc' },
      });
      sendSuccess(res, interviewers);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/interviews/metadata/pending-requests
 * Lists pending client interview requests that need recruiter scheduling
 */
interviewsRouter.get(
  '/interviews/metadata/pending-requests',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingRequests = await prisma.interviewRequest.findMany({
        where: {
          organizationId: req.user!.organizationId!,
          status: InterviewRequestStatus.PENDING,
        },
        include: {
          application: {
            select: {
              id: true,
              candidate: {
                select: { id: true, name: true, normalizedEmail: true, candidateCode: true },
              },
            },
          },
          job: {
            select: { id: true, jobCode: true, title: true },
          },
          client: {
            select: { id: true, name: true },
          },
          requestedBy: {
            select: { id: true, fullName: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      sendSuccess(res, pendingRequests);
    } catch (err) {
      next(err);
    }
  }
);


/**
 * GET /api/interviews/:id
 * Get single interview details
 */
interviewsRouter.get(
  '/interviews/:id',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const interview = await InterviewService.getInterview(req.user!, id);
      sendSuccess(res, interview);
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
 * POST /api/interviews
 * Schedule a new interview
 */
interviewsRouter.post(
  '/interviews',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = ScheduleInterviewSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid interview payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const created = await InterviewService.scheduleInterview(req.user!, parse.data);
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
 * PATCH /api/interviews/:id/reschedule
 * Reschedule an interview
 */
interviewsRouter.patch(
  '/interviews/:id/reschedule',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parse = RescheduleInterviewSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid reschedule payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await InterviewService.rescheduleInterview(req.user!, id, parse.data);
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
 * PATCH /api/interviews/:id/cancel
 * Cancel an interview
 */
interviewsRouter.patch(
  '/interviews/:id/cancel',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parse = CancelInterviewSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid cancellation payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await InterviewService.cancelInterview(req.user!, id, parse.data);
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
 * PATCH /api/interviews/:id/complete
 * Mark an interview completed
 */
interviewsRouter.patch(
  '/interviews/:id/complete',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parse = CompleteInterviewSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid completion payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await InterviewService.completeInterview(req.user!, id, parse.data);
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
 * PATCH /api/interviews/:id/no-show
 * Mark an interview as no-show
 */
interviewsRouter.patch(
  '/interviews/:id/no-show',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parse = RecordNoShowSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid no-show payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await InterviewService.recordNoShow(req.user!, id, parse.data);
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
 * PATCH /api/interviews/:id/feedback
 * Update interview feedback and evaluation result
 */
interviewsRouter.patch(
  '/interviews/:id/feedback',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const parse = UpdateFeedbackSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid feedback payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const updated = await InterviewService.updateFeedback(req.user!, id, parse.data);
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
 * POST /api/interviews/:id/communications/:commId/retry
 * Manual retry for a failed outbound communication
 */
interviewsRouter.post(
  '/interviews/:id/communications/:commId/retry',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, commId } = req.params;
      // Ensure interview exists and is in user org
      await InterviewService.getInterview(req.user!, id);
      const success = await EmailService.retryCommunication(commId, req.user!.organizationId!);
      sendSuccess(res, { retried: true, success });
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
 * GET /api/interviews/:id/ics
 * Download standard RFC 5545 .ics iCalendar file
 */
interviewsRouter.get(
  '/interviews/:id/ics',
  authenticate,
  requireRole(...recruiterRoles),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const ics = await InterviewService.getIcsCalendar(req.user!, id);

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="interview-${id}.ics"`);
      res.send(ics);
    } catch (err: any) {
      if (err.statusCode) {
        sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }
);
