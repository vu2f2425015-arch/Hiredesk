import { Router, Request, Response, NextFunction } from 'express';
import { NotificationQuerySchema, UserRole } from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { NotificationService } from '../services/notifications.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const notificationsRouter = Router();

notificationsRouter.use(
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER)
);

/**
 * GET /api/notifications
 * Lists notifications for authenticated caller.
 */
notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = NotificationQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parseResult.error.flatten());
      return;
    }

    const result = await NotificationService.listNotifications(req.user!, parseResult.data);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/notifications/unread-count
 * Returns unread notification count.
 */
notificationsRouter.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await NotificationService.getUnreadCount(req.user!);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks single notification as read.
 */
notificationsRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await NotificationService.markAsRead(req.user!, id);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * POST /api/notifications/mark-all-read
 * Marks all unread notifications as read.
 */
notificationsRouter.post('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user!);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});
