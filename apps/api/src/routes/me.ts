import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';
import { UserRole } from '@hiredesk/shared';

export const meRouter = Router();

meRouter.get('/me', authenticate, (req: Request, res: Response) => {
  const user = req.user!;

  const permissions = {
    isSuperAdmin: user.role === UserRole.SUPER_ADMIN,
    isManager: user.role === UserRole.MANAGER,
    isRecruiter: user.role === UserRole.RECRUITER,
    isClient: user.role === UserRole.CLIENT,
    canManageJobs: [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER].includes(user.role),
    canManageClients: [UserRole.SUPER_ADMIN, UserRole.MANAGER].includes(user.role),
    canReviewCandidates: true,
  };

  sendSuccess(res, {
    user,
    permissions,
  });
});
