import { Router, Request, Response, NextFunction } from 'express';
import { AiRecruiterMatchRequestSchema, UserRole } from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { AiRecruiterService } from '../services/aiRecruiter.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const aiRecruiterRouter = Router();

aiRecruiterRouter.use(
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER)
);

/**
 * GET /api/ai-recruiter/status
 * Returns current AI provider configuration status and transparent capabilities.
 */
aiRecruiterRouter.get('/status', (req: Request, res: Response) => {
  const status = AiRecruiterService.getStatus();
  sendSuccess(res, status);
});

/**
 * POST /api/ai-recruiter/match
 * Computes decision support evaluation for an application against job specifications.
 */
aiRecruiterRouter.post('/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parse = AiRecruiterMatchRequestSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid match request', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const evaluation = await AiRecruiterService.evaluateMatch(req.user!, parse.data);
    sendSuccess(res, evaluation);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});
