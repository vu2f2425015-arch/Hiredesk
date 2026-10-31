import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "@hiredesk/database";
import { RegisterUserSchema, UserRole } from "@hiredesk/shared";
import { config } from "../config/index.js";
import { getSupabaseAdminClient } from "../services/auth.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const authRouter = Router();

// Rate limiter for self-service public registration: max 10 attempts per 15 minutes per IP
const authRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === "test",
  handler: (req: Request, res: Response) => {
    sendError(
      res,
      "RATE_LIMIT_EXCEEDED",
      "Too many registration attempts from this IP address. Please try again later.",
      429,
    );
  },
});

/**
 * POST /api/auth/register
 * Self-service registration for new agency organizations.
 * Provisions Supabase Auth user, tenant Organization, default Client, and UserProfile atomically.
 */
authRouter.post(
  "/auth/register",
  authRegisterLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = RegisterUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        sendError(
          res,
          "VALIDATION_ERROR",
          "Invalid registration payload",
          400,
          parseResult.error.flatten().fieldErrors,
        );
        return;
      }

      const { email, password, firstName, lastName, organizationName } =
        parseResult.data;
      const normalizedEmail = email.toLowerCase().trim();

      // 1. Verify that this email is not already associated with an existing database profile
      const existingProfile = await prisma.userProfile.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
      });

      if (existingProfile) {
        sendError(
          res,
          "CONFLICT",
          "An account with this email address already exists. Please sign in.",
          409,
        );
        return;
      }

      // 2. Create user in Supabase Auth via Admin Client
      let authUserId: string;
      let createdNewAuthUser = false;
      let newAuthUserId: string | null = null;
      const supabaseAdmin = getSupabaseAdminClient();

      if (supabaseAdmin) {
        const { data: createData, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email: normalizedEmail,
            password,
            // Crucial: email_confirm: true is omitted. Unverified accounts must follow verified-email workflow.
            user_metadata: {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              organizationName: organizationName.trim(),
            },
          });

        if (createError) {
          // Safe Conflict Response: If user already exists in Supabase Auth, NEVER list or modify that account.
          const msg = createError.message.toLowerCase();
          if (
            msg.includes("already registered") ||
            msg.includes("already exists") ||
            (createError as any).status === 422
          ) {
            logger.warn(
              { email: normalizedEmail },
              "Registration conflict: email already exists in Supabase Auth",
            );
            sendError(
              res,
              "CONFLICT",
              "An account with this email address already exists. Please sign in.",
              409,
            );
            return;
          }

          // Error redaction: Do not leak internal auth server messages or credentials
          logger.error(
            { err: createError.message },
            "Failed to create user in Supabase Auth",
          );
          sendError(
            res,
            "AUTH_ERROR",
            "Registration could not be completed. Please check your information and try again.",
            400,
          );
          return;
        }

        if (createData?.user) {
          authUserId = createData.user.id;
          createdNewAuthUser = true;
          newAuthUserId = createData.user.id;
        } else {
          authUserId = randomUUID();
        }
      } else {
        // Offline/Test fallback when Supabase admin client is not configured
        authUserId = randomUUID();
      }

      // 3. Database Organization and UserProfile provisioning with controlled cleanup
      try {
        // Generate clean unique slug for the Organization
        const baseSlug =
          organizationName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "agency";

        let slug = baseSlug;
        let counter = 1;
        while (await prisma.organization.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${counter++}`;
        }

        // Atomically provision Organization, initial Client, and UserProfile in Prisma
        // Role is strictly hardcoded to UserRole.MANAGER - public registration can NEVER grant SUPER_ADMIN
        const [org, initialClient, profile] = await prisma.$transaction(
          async (tx) => {
            const newOrg = await tx.organization.create({
              data: {
                name: organizationName.trim(),
                slug,
                status: "active",
              },
            });

            const newClient = await tx.client.create({
              data: {
                organizationId: newOrg.id,
                name: `${organizationName.trim()} (Internal)`,
                contactEmail: normalizedEmail,
                status: "active",
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
          },
        );

        logger.info(
          {
            profileId: profile.id,
            organizationId: org.id,
            email: normalizedEmail,
          },
          "Successfully registered new agency organization and manager",
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
            emailConfirmed: false,
            requiresEmailVerification: true,
          },
          201,
        );
      } catch (dbErr: any) {
        // Controlled cleanup: If Auth user was newly created in this request but DB provisioning failed,
        // delete ONLY the newly created user to prevent orphaned Auth accounts.
        // Pre-existing users are NEVER touched because createdNewAuthUser is only true for new users.
        if (createdNewAuthUser && newAuthUserId && supabaseAdmin) {
          try {
            logger.warn(
              { authUserId: newAuthUserId, email: normalizedEmail },
              "Controlled cleanup: Rolling back newly created Supabase Auth user due to database provisioning failure",
            );
            await supabaseAdmin.auth.admin.deleteUser(newAuthUserId);
          } catch (cleanupErr) {
            logger.error(
              { cleanupErr, authUserId: newAuthUserId },
              "Failed to rollback orphaned Supabase Auth user during database provisioning failure",
            );
          }
        }
        throw dbErr;
      }
    } catch (err: any) {
      logger.error({ err }, "Unhandled error during registration");
      next(err);
    }
  },
);
