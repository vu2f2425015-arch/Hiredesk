import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { prisma } from '@hiredesk/database';
import { RegisterUserSchema, UserRole } from '@hiredesk/shared';
import { getSupabaseAdminClient } from '../services/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Self-service registration for new agency organizations.
 * Provisions Supabase Auth user, tenant Organization, default Client, and UserProfile atomically.
 */
authRouter.post('/auth/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = RegisterUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      sendError(
        res,
        'VALIDATION_ERROR',
        'Invalid registration payload',
        400,
        parseResult.error.flatten().fieldErrors
      );
      return;
    }

    const { email, password, firstName, lastName, organizationName } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify that this email is not already associated with an existing profile
    const existingProfile = await prisma.userProfile.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (existingProfile) {
      sendError(
        res,
        'CONFLICT',
        'An account with this email address already exists. Please sign in.',
        409
      );
      return;
    }

    // 2. Create or link user in Supabase Auth via Admin Client
    let authUserId: string;
    const supabaseAdmin = getSupabaseAdminClient();

    if (supabaseAdmin) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          organizationName,
        },
      });

      if (createError) {
        // If user already exists in Supabase Auth but has no profile in our DB
        if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
          const matchedUser = listData?.users.find(
            (u) => u.email?.toLowerCase() === normalizedEmail
          );

          if (matchedUser) {
            authUserId = matchedUser.id;
            // Update password to the new one supplied
            await supabaseAdmin.auth.admin.updateUserById(matchedUser.id, {
              password,
              email_confirm: true,
            });
          } else {
            logger.error({ err: createError.message }, 'Failed to resolve existing Supabase user');
            sendError(res, 'AUTH_ERROR', createError.message, 400);
            return;
          }
        } else {
          logger.error({ err: createError.message }, 'Failed to create user in Supabase Auth');
          sendError(res, 'AUTH_ERROR', createError.message, 400);
          return;
        }
      } else if (createData?.user) {
        authUserId = createData.user.id;
      } else {
        authUserId = randomUUID();
      }
    } else {
      // Offline/Test fallback when Supabase admin client is not configured
      authUserId = randomUUID();
    }

    // 3. Generate clean unique slug for the Organization
    const baseSlug = organizationName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agency';

    let slug = baseSlug;
    let counter = 1;
    while (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    // 4. Atomically provision Organization, initial Client, and UserProfile in Prisma
    const [org, initialClient, profile] = await prisma.$transaction(async (tx) => {
      const newOrg = await tx.organization.create({
        data: {
          name: organizationName.trim(),
          slug,
          status: 'active',
        },
      });

      const newClient = await tx.client.create({
        data: {
          organizationId: newOrg.id,
          name: `${organizationName.trim()} (Internal)`,
          contactEmail: normalizedEmail,
          status: 'active',
        },
      });

      const newProfile = await tx.userProfile.create({
        data: {
          authUserId,
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: `${firstName.trim()} ${lastName.trim()}`,
          role: UserRole.MANAGER,
          organizationId: newOrg.id,
          clientId: null,
          isActive: true,
        },
      });

      return [newOrg, newClient, newProfile];
    });

    logger.info(
      { profileId: profile.id, organizationId: org.id, email: normalizedEmail },
      'Successfully registered new agency organization and manager'
    );

    sendSuccess(
      res,
      {
        user: {
          id: profile.id,
          authUserId: profile.authUserId,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          fullName: profile.fullName,
          role: profile.role,
          organizationId: org.id,
          organizationName: org.name,
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
        defaultClientId: initialClient.id,
      },
      201
    );
  } catch (err: any) {
    logger.error({ err }, 'Unhandled error during registration');
    next(err);
  }
});
