import { Router, Request, Response, NextFunction } from 'express';
import {
  TalentPoolQuerySchema,
  CreateTalentPoolFolderSchema,
  UpdateTalentPoolFolderSchema,
  AddCandidateToFolderSchema,
  AssociateCandidateWithJobSchema,
  UserRole,
} from '@hiredesk/shared';
import { authenticate, requireRole } from '../middleware/auth.js';
import { TalentPoolService } from '../services/talentPool.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const talentPoolRouter = Router();

// Require authenticated recruiter, manager, or super-admin for all Talent Pool routes
talentPoolRouter.use(
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER)
);

/**
 * GET /api/talent-pool/candidates
 * Searches and filters candidates within the caller's organization.
 */
talentPoolRouter.get('/candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = TalentPoolQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400, parseResult.error.flatten());
      return;
    }

    const result = await TalentPoolService.listCandidates(req.user!, parseResult.data);
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
 * GET /api/talent-pool/candidates/:id
 * Retrieves full candidate profile across all jobs within the tenant.
 */
talentPoolRouter.get('/candidates/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const candidate = await TalentPoolService.getCandidate(req.user!, id);
    sendSuccess(res, candidate);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * POST /api/talent-pool/candidates/:id/applications
 * Associates candidate with another job in the organization.
 */
talentPoolRouter.post('/candidates/:id/applications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parseResult = AssociateCandidateWithJobSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid application payload', 400, parseResult.error.flatten());
      return;
    }

    const result = await TalentPoolService.associateCandidateWithJob(req.user!, id, parseResult.data);
    sendSuccess(res, result, result.isExisting ? 200 : 201);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * GET /api/talent-pool/folders
 * Lists current organization's talent pool folders.
 */
talentPoolRouter.get('/folders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folders = await TalentPoolService.listFolders(req.user!);
    sendSuccess(res, folders);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * POST /api/talent-pool/folders
 * Creates a new folder within the organization.
 */
talentPoolRouter.post('/folders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = CreateTalentPoolFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid folder data', 400, parseResult.error.flatten());
      return;
    }

    const folder = await TalentPoolService.createFolder(req.user!, parseResult.data);
    sendSuccess(res, folder, 201);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * PATCH /api/talent-pool/folders/:id
 * Updates folder name or description within the organization.
 */
talentPoolRouter.patch('/folders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parseResult = UpdateTalentPoolFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid folder data', 400, parseResult.error.flatten());
      return;
    }

    const folder = await TalentPoolService.updateFolder(req.user!, id, parseResult.data);
    sendSuccess(res, folder);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});

/**
 * DELETE /api/talent-pool/folders/:id
 * Deletes a folder without affecting candidate records.
 */
talentPoolRouter.delete('/folders/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await TalentPoolService.deleteFolder(req.user!, id);
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
 * POST /api/talent-pool/folders/:id/candidates
 * Adds a candidate to a folder.
 */
talentPoolRouter.post('/folders/:id/candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: folderId } = req.params;
    const parseResult = AddCandidateToFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid payload', 400, parseResult.error.flatten());
      return;
    }

    const result = await TalentPoolService.addCandidateToFolder(req.user!, folderId, parseResult.data.candidateId);
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
 * DELETE /api/talent-pool/folders/:id/candidates/:candidateId
 * Removes a candidate from a folder.
 */
talentPoolRouter.delete('/folders/:id/candidates/:candidateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: folderId, candidateId } = req.params;
    const result = await TalentPoolService.removeCandidateFromFolder(req.user!, folderId, candidateId);
    sendSuccess(res, result);
  } catch (err: any) {
    if (err.statusCode) {
      sendError(res, err.code || 'BAD_REQUEST', err.message, err.statusCode);
      return;
    }
    next(err);
  }
});
