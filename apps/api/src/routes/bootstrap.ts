import { Router, Request, Response } from 'express';
import { prisma } from '@hiredesk/database';
import { BootstrapSuperAdminSchema, UserRole } from '@hiredesk/shared';
import { config } from '../config/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const bootstrapRouter = Router();

/**
 * Safe initial platform bootstrap route.
 * Can ONLY succeed if:
 * 1. The provided bootstrapSecret matches config.BOOTSTRAP_SECRET.
 * 2. Zero super_admin profiles exist in the database.
 * Once a super_admin exists, this endpoint permanently refuses new requests with 409 Conflict.
 */
bootstrapRouter.post('/bootstrap/super-admin', async (req: Request, res: Response) => {
  const parseResult = BootstrapSuperAdminSchema.safeParse(req.body);
  if (!parseResult.success) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid bootstrap payload', 400, parseResult.error.flatten().fieldErrors);
    return;
  }

  const { authUserId, email, firstName, lastName, bootstrapSecret } = parseResult.data;

  // 1. Verify bootstrap secret (strictly disallow default secret in production)
  if (config.NODE_ENV === 'production' && config.BOOTSTRAP_SECRET === 'hiredesk-local-bootstrap-secret') {
    logger.error('Refused bootstrap: default BOOTSTRAP_SECRET cannot be used in production environment');
    sendError(res, 'FORBIDDEN', 'Default bootstrap secret is prohibited in production', 403);
    return;
  }

  if (bootstrapSecret !== config.BOOTSTRAP_SECRET) {
    logger.warn({ email, authUserId }, 'Unauthorized bootstrap attempt with invalid secret');
    sendError(res, 'UNAUTHORIZED', 'Invalid platform bootstrap secret', 401);
    return;
  }

  // 2. Verify no super_admin exists yet
  const existingSuperAdmin = await prisma.userProfile.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
  });

  if (existingSuperAdmin) {
    logger.warn({ existingAdminId: existingSuperAdmin.id }, 'Refused bootstrap: super_admin already exists');
    sendError(
      res,
      'CONFLICT',
      'Platform super-admin has already been bootstrapped. Use administrative APIs.',
      409
    );
    return;
  }

  // 3. Check if this authUserId already has a profile
  const existingProfile = await prisma.userProfile.findUnique({
    where: { authUserId },
  });

  if (existingProfile) {
    sendError(res, 'CONFLICT', 'User profile already exists for this Supabase Auth ID', 409);
    return;
  }

  // 4. Atomically create the initial super_admin profile
  const profile = await prisma.userProfile.create({
    data: {
      authUserId,
      email,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      role: UserRole.SUPER_ADMIN,
      organizationId: null,
      clientId: null,
      isActive: true,
    },
  });

  logger.info({ profileId: profile.id, email }, 'Platform super-admin successfully bootstrapped');

  sendSuccess(
    res,
    {
      profile: {
        id: profile.id,
        authUserId: profile.authUserId,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        isActive: profile.isActive,
      },
    },
    201
  );
});
