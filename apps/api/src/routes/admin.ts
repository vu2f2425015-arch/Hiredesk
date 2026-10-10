import { Router, Request, Response } from 'express';
import { prisma } from '@hiredesk/database';
import {
  CreateOrganizationSchema,
  CreateClientSchema,
  CreateUserSchema,
  UserRole,
} from '@hiredesk/shared';
import {
  authenticate,
  requireRole,
  assertOrganizationAccess,
  assertClientAccess,
} from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export const adminRouter = Router();

/**
 * POST /api/admin/organizations
 * Platform super_admin creates a new agency organization tenant.
 */
adminRouter.post(
  '/admin/organizations',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response) => {
    const parse = CreateOrganizationSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid organization data', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const { name, slug } = parse.data;

    const existingSlug = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      sendError(res, 'CONFLICT', 'Organization with this slug already exists', 409);
      return;
    }

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        status: 'active',
      },
    });

    logger.info({ organizationId: org.id, name: org.name }, 'Organization created by super_admin');
    sendSuccess(res, org, 201);
  }
);

/**
 * POST /api/admin/clients
 * super_admin or organization manager creates a client company under an organization.
 */
adminRouter.post(
  '/admin/clients',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    const parse = CreateClientSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid client data', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const user = req.user!;
    let targetOrgId = parse.data.organizationId;

    // Enforce tenant scoping: manager cannot create client for another organization
    if (user.role === UserRole.MANAGER) {
      targetOrgId = user.organizationId!;
    } else if (!targetOrgId) {
      sendError(res, 'VALIDATION_ERROR', 'organizationId is required for platform administrators', 400);
      return;
    }

    const org = await prisma.organization.findUnique({
      where: { id: targetOrgId },
    });

    if (!org) {
      sendError(res, 'NOT_FOUND', 'Target organization not found', 404);
      return;
    }

    const client = await prisma.client.create({
      data: {
        organizationId: targetOrgId,
        name: parse.data.name,
        contactEmail: parse.data.contactEmail,
        contactPhone: parse.data.contactPhone,
        status: 'active',
      },
    });

    logger.info({ clientId: client.id, organizationId: targetOrgId }, 'Client created');
    sendSuccess(res, client, 201);
  }
);

/**
 * POST /api/admin/users
 * Provision or associate a user profile for a verified Supabase Auth user.
 * Enforces strict anti-privilege-escalation rules.
 */
adminRouter.post(
  '/admin/users',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    const parse = CreateUserSchema.safeParse(req.body);
    if (!parse.success) {
      sendError(res, 'VALIDATION_ERROR', 'Invalid user profile data', 400, parse.error.flatten().fieldErrors);
      return;
    }

    const caller = req.user!;
    const input = parse.data;

    // 1. Privilege Escalation Guard: Only super_admin can create super_admin
    if (input.role === UserRole.SUPER_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
      logger.warn({ callerId: caller.id, targetRole: input.role }, 'Privilege escalation attempt blocked');
      sendError(res, 'FORBIDDEN', 'Only platform administrators can create super_admin users', 403);
      return;
    }

    // 2. Tenant Scoping Guard: Managers are locked to their own organization
    let targetOrgId = input.organizationId;
    if (caller.role === UserRole.MANAGER) {
      targetOrgId = caller.organizationId!;
    }

    if (input.role !== UserRole.SUPER_ADMIN && !targetOrgId) {
      sendError(res, 'VALIDATION_ERROR', 'organizationId is required for this role', 400);
      return;
    }

    // 3. Client Role Guard: Client users must have a clientId belonging to the same organization
    let targetClientId: string | null = null;
    if (input.role === UserRole.CLIENT) {
      if (!input.clientId) {
        sendError(res, 'VALIDATION_ERROR', 'clientId is required for client role', 400);
        return;
      }

      const client = await prisma.client.findFirst({
        where: { id: input.clientId, organizationId: targetOrgId! },
      });

      if (!client) {
        sendError(res, 'BAD_REQUEST', 'Specified client does not belong to the target organization', 400);
        return;
      }

      targetClientId = client.id;
    }

    // 4. Duplicate Check
    const existing = await prisma.userProfile.findUnique({
      where: { authUserId: input.authUserId },
    });

    if (existing) {
      sendError(res, 'CONFLICT', 'User profile already exists for this Supabase Auth user', 409);
      return;
    }

    const newProfile = await prisma.userProfile.create({
      data: {
        authUserId: input.authUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        fullName: `${input.firstName} ${input.lastName}`,
        role: input.role,
        organizationId: targetOrgId || null,
        clientId: targetClientId,
        isActive: true,
      },
    });

    logger.info({ profileId: newProfile.id, role: newProfile.role }, 'User profile created');
    sendSuccess(res, newProfile, 201);
  }
);

/**
 * GET /api/admin/organizations/:id
 * Retrieve organization details with tenant boundary verification.
 */
adminRouter.get('/admin/organizations/:id', authenticate, async (req: Request, res: Response) => {
  const targetOrgId = req.params.id;

  if (!assertOrganizationAccess(req.user!, targetOrgId)) {
    sendError(res, 'FORBIDDEN', 'Access denied to this organization', 403);
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: targetOrgId },
    include: {
      clients: { select: { id: true, name: true, status: true } },
    },
  });

  if (!org) {
    sendError(res, 'NOT_FOUND', 'Organization not found', 404);
    return;
  }

  sendSuccess(res, org);
});

/**
 * GET /api/admin/clients/:id
 * Retrieve client details with cross-client isolation verification.
 */
adminRouter.get('/admin/clients/:id', authenticate, async (req: Request, res: Response) => {
  const targetClientId = req.params.id;

  const client = await prisma.client.findUnique({
    where: { id: targetClientId },
  });

  if (!client) {
    sendError(res, 'NOT_FOUND', 'Client not found', 404);
    return;
  }

  // Cross-tenant check
  if (!assertOrganizationAccess(req.user!, client.organizationId)) {
    sendError(res, 'FORBIDDEN', 'Access denied to this client organization', 403);
    return;
  }

  // Cross-client check for client-role users
  if (!assertClientAccess(req.user!, client.id)) {
    sendError(res, 'FORBIDDEN', 'Access denied: client users cannot view other clients', 403);
    return;
  }

  sendSuccess(res, client);
});
