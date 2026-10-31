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

  // Check and create at serializable isolation so two simultaneous valid
  // bootstrap requests cannot both observe an empty admin table and succeed.
  let profile;
  try {
    profile = await prisma.$transaction(
      async (tx) => {
        const existingSuperAdmin = await tx.userProfile.findFirst({
          where: { role: UserRole.SUPER_ADMIN },
        });

        if (existingSuperAdmin) {
          const err = new Error('Platform super-admin has already been bootstrapped. Use administrative APIs.');
          (err as any).code = 'BOOTSTRAP_ALREADY_COMPLETED';
          throw err;
        }

        const existingProfile = await tx.userProfile.findUnique({ where: { authUserId } });
        if (existingProfile) {
          const err = new Error('User profile already exists for this Supabase Auth ID');
          (err as any).code = 'PROFILE_ALREADY_EXISTS';
          throw err;
        }

        return tx.userProfile.create({
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
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (err: any) {
    if (err.code === 'BOOTSTRAP_ALREADY_COMPLETED') {
      logger.warn('Refused bootstrap: super_admin already exists');
      sendError(res, 'CONFLICT', err.message, 409);
      return;
    }
    if (err.code === 'PROFILE_ALREADY_EXISTS') {
      sendError(res, 'CONFLICT', err.message, 409);
      return;
    }
    // Prisma uses P2034 for a serializable transaction conflict. Treat a
    // concurrent bootstrap loser as an already-completed bootstrap.
    if (err.code === 'P2034') {
      sendError(res, 'CONFLICT', 'Platform super-admin has already been bootstrapped.', 409);
      return;
    }
    throw err;
  }

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
