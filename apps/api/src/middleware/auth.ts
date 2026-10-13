import { Request, Response, NextFunction } from 'express';
import { prisma } from '@hiredesk/database';
import { UserRole } from '@hiredesk/shared';
import { verifyToken } from '../services/auth.js';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  id: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string | null;
  role: UserRole;
  organizationId: string | null;
  organizationName: string | null;
  clientId: string | null;
  clientName: string | null;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Validates Supabase JWT from Authorization header, resolves UserProfile,
 * and attaches verified AuthenticatedUser context to req.user.
 */
interface CachedProfile {
  user: AuthenticatedUser;
  expiresAt: number;
}
const profileCache = new Map<string, CachedProfile>();
const PROFILE_CACHE_TTL_MS = 60 * 1000;

export function clearProfileCache(): void {
  profileCache.clear();
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    sendError(res, 'UNAUTHORIZED', 'Empty bearer token supplied', 401);
    return;
  }

  try {
    const verified = await verifyToken(token);

    if (!verified || !verified.authUserId) {
      sendError(res, 'UNAUTHORIZED', 'Invalid or expired access token', 401);
      return;
    }

    // Check in-memory profile cache
    const cached = profileCache.get(verified.authUserId);
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user;
      next();
      return;
    }

    // Look up profile in database
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: verified.authUserId },
      include: {
        organization: true,
        client: true,
      },
    });

    if (!profile) {
      logger.warn({ authUserId: verified.authUserId }, 'Authenticated token has no associated user profile');
      sendError(res, 'PROFILE_NOT_FOUND', 'User profile not found for this account', 403);
      return;
    }

    if (!profile.isActive) {
      logger.warn({ profileId: profile.id, authUserId: verified.authUserId }, 'Disabled user attempted access');
      sendError(res, 'ACCOUNT_DISABLED', 'User account has been disabled', 403);
      return;
    }

    let organizationId = profile.organizationId;
    let organizationName = profile.organization ? profile.organization.name : null;

    // If Super Admin has no assigned organization, auto-bind to the primary organization
    if (!organizationId && profile.role === UserRole.SUPER_ADMIN && prisma.organization?.findFirst) {
      const defaultOrg = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      if (defaultOrg) {
        organizationId = defaultOrg.id;
        organizationName = defaultOrg.name;
      }
    }

    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      authUserId: profile.authUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: profile.fullName || `${profile.firstName} ${profile.lastName}`,
      role: profile.role as UserRole,
      organizationId,
      organizationName,
      clientId: profile.clientId,
      clientName: profile.client ? profile.client.name : null,
      isActive: profile.isActive,
    };

    profileCache.set(verified.authUserId, {
      user: authenticatedUser,
      expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    });
    if (profileCache.size > 1000) {
      const oldest = profileCache.keys().next().value;
      if (oldest) profileCache.delete(oldest);
    }

    req.user = authenticatedUser;
    next();
  } catch (err) {
    logger.error({ err }, 'Error during request authentication');
    sendError(res, 'UNAUTHORIZED', 'Authentication failed', 401);
  }
}

/**
 * Middleware ensuring caller has at least one of the specified roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        { userId: req.user.id, role: req.user.role, requiredRoles: roles },
        'Role-based authorization denied'
      );
      sendError(res, 'FORBIDDEN', 'Insufficient permissions for this action', 403);
      return;
    }

    next();
  };
}

/**
 * Middleware ensuring the authenticated user belongs to an organization (unless super_admin).
 */
export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  if (req.user.role === UserRole.SUPER_ADMIN) {
    next();
    return;
  }

  if (!req.user.organizationId) {
    sendError(res, 'TENANT_REQUIRED', 'No active organization associated with user', 403);
    return;
  }

  next();
}

/**
 * Helper to enforce that target organizationId matches the caller's organization.
 */
export function assertOrganizationAccess(user: AuthenticatedUser, targetOrgId: string): boolean {
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }
  return user.organizationId === targetOrgId;
}

/**
 * Helper to enforce that target clientId matches the caller's client (if caller is client role).
 */
export function assertClientAccess(user: AuthenticatedUser, targetClientId: string): boolean {
  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }
  if (user.role === UserRole.CLIENT) {
    return user.clientId === targetClientId;
  }
  return true; // manager and recruiter can access clients within their org
}
