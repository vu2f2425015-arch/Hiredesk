import { Router, Request, Response, NextFunction } from 'express';
import {
  InboundQuerySchema,
  ManualAssignSchema,
  IgnoreInboundSchema,
  UserRole,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { InboundService } from '../services/inbound.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const inboundRouter = Router();

/**
 * GET /api/admin/inbound-applications
 * List/filter inbound application queue records (super_admin, manager, recruiter).
 */
inboundRouter.get(
  '/admin/inbound-applications',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = InboundQuerySchema.safeParse(req.query);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await InboundService.listInboundApplications(req.user!, parse.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/admin/inbound-applications/:id
 * Retrieve a single inbound record details.
 */
inboundRouter.get(
  '/admin/inbound-applications/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await InboundService.getInboundApplicationById(req.user!, req.params.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/inbound-applications/:id/assign
 * Manually assign an unmatched email to a specific published Job.
 */
inboundRouter.post(
  '/admin/inbound-applications/:id/assign',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = ManualAssignSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Invalid assignment payload', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await InboundService.manualAssign(req.user!, req.params.id, parse.data);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/inbound-applications/:id/retry
 * Retry a failed or retrying inbound message.
 */
inboundRouter.post(
  '/admin/inbound-applications/:id/retry',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await InboundService.retry(req.user!, req.params.id);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/admin/inbound-applications/:id/ignore
 * Mark an inbound message as ignored with reason.
 */
inboundRouter.post(
  '/admin/inbound-applications/:id/ignore',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parse = IgnoreInboundSchema.safeParse(req.body);
      if (!parse.success) {
        sendError(res, 'VALIDATION_ERROR', 'Reason is required to ignore an inbound application', 400, parse.error.flatten().fieldErrors);
        return;
      }

      const result = await InboundService.ignore(req.user!, req.params.id, parse.data.reason);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
);
