import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { UserRole } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    prisma: mockPrisma,
  };
});

// Import the mocked prisma
import { prisma } from '@hiredesk/database';

describe('Phase 1: Supabase Authentication & Multi-Tenant Authorization Suite', () => {
  const app = createApp();

  const mockUsers = {
    superAdmin: {
      id: 'profile-super-admin-uuid',
      authUserId: 'auth-super-admin-uuid',
      email: 'admin@platform.com',
      firstName: 'Platform',
      lastName: 'Admin',
      fullName: 'Platform Admin',
      role: UserRole.SUPER_ADMIN,
      organizationId: null,
      organization: null,
      clientId: null,
      client: null,
      isActive: true,
    },
    recruiterOrgA: {
      id: 'profile-recruiter-org-a',
      authUserId: 'auth-recruiter-org-a',
      email: 'recruiter@agency-a.com',
      firstName: 'Alice',
      lastName: 'Recruiter',
      fullName: 'Alice Recruiter',
      role: UserRole.RECRUITER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency' },
      clientId: null,
      client: null,
      isActive: true,
    },
    managerOrgA: {
      id: 'profile-manager-org-a',
      authUserId: 'auth-manager-org-a',
      email: 'manager@agency-a.com',
      firstName: 'Bob',
      lastName: 'Manager',
      fullName: 'Bob Manager',
      role: UserRole.MANAGER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency' },
      clientId: null,
      client: null,
      isActive: true,
    },
    clientUser1: {
      id: 'profile-client-1',
      authUserId: 'auth-client-1',
      email: 'client1@company-one.com',
      firstName: 'Carol',
      lastName: 'Client',
      fullName: 'Carol Client',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency' },
      clientId: 'client-1-uuid',
      client: { id: 'client-1-uuid', name: 'Company One' },
      isActive: true,
    },
    disabledUser: {
      id: 'profile-disabled',
      authUserId: 'auth-disabled',
      email: 'disabled@agency-a.com',
      firstName: 'Dave',
      lastName: 'Disabled',
      fullName: 'Dave Disabled',
      role: UserRole.RECRUITER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency' },
      clientId: null,
      client: null,
      isActive: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetTokenVerifier();

    // Configure mock token verifier
    setTokenVerifier(async (token: string) => {
      if (token === 'token-super-admin') return { authUserId: 'auth-super-admin-uuid', email: 'admin@platform.com' };
      if (token === 'token-recruiter-a') return { authUserId: 'auth-recruiter-org-a', email: 'recruiter@agency-a.com' };
      if (token === 'token-manager-a') return { authUserId: 'auth-manager-org-a', email: 'manager@agency-a.com' };
      if (token === 'token-client-1') return { authUserId: 'auth-client-1', email: 'client1@company-one.com' };
      if (token === 'token-disabled') return { authUserId: 'auth-disabled', email: 'disabled@agency-a.com' };
      if (token === 'token-unmapped') return { authUserId: 'auth-unmapped-uuid', email: 'unmapped@agency-a.com' };
      return null;
    });

    // Configure prisma findUnique userProfile mock
    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: { where: { authUserId?: string; id?: string } }) => {
      if (where.authUserId === 'auth-super-admin-uuid') return Promise.resolve(mockUsers.superAdmin);
      if (where.authUserId === 'auth-recruiter-org-a') return Promise.resolve(mockUsers.recruiterOrgA);
      if (where.authUserId === 'auth-manager-org-a') return Promise.resolve(mockUsers.managerOrgA);
      if (where.authUserId === 'auth-client-1') return Promise.resolve(mockUsers.clientUser1);
      if (where.authUserId === 'auth-disabled') return Promise.resolve(mockUsers.disabledUser);
      return Promise.resolve(null);
    });
  });

  // Test 1: Unauthenticated /api/me returns 401
  it('1. Unauthenticated request to /api/me returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // Test 2: Invalid token returns 401
  it('2. Invalid bearer token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer invalid-garbage-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // Test 3: Expired token returns 401
  it('3. Expired bearer token returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // Test 4: Valid user receives their own profile
  it('4. Valid authenticated user receives their own profile and permissions', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer token-recruiter-a');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('recruiter@agency-a.com');
    expect(res.body.data.user.role).toBe(UserRole.RECRUITER);
    expect(res.body.data.user.organizationId).toBe('org-a-uuid');
    expect(res.body.data.permissions.canManageJobs).toBe(true);
    expect(res.body.data.permissions.isSuperAdmin).toBe(false);
  });

  // Test 5: Disabled user cannot access protected APIs (403)
  it('5. Disabled user profile cannot access protected APIs (403 Forbidden)', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer token-disabled');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  // Test 6: Missing user profile fails safely (403)
  it('6. Token with missing database profile fails safely (403 Forbidden)', async () => {
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer token-unmapped');
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  // Test 7: Recruiter cannot access platform-admin operations (403)
  it('7. Recruiter cannot access platform-admin organization creation (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/admin/organizations')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ name: 'Hacked Org', slug: 'hacked-org' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Test 8: Recruiter cannot access another organization's data
  it("8. Recruiter cannot access another organization's details (403 Forbidden)", async () => {
    const res = await request(app)
      .get('/api/admin/organizations/org-b-uuid')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Test 9: Client cannot access another client's data
  it("9. Client user cannot access another client's data (403 Forbidden)", async () => {
    (prisma.client.findUnique as any).mockResolvedValueOnce({
      id: 'client-2-uuid',
      organizationId: 'org-a-uuid',
      name: 'Company Two',
      contactEmail: 'contact@two.com',
    });

    const res = await request(app).get('/api/admin/clients/client-2-uuid').set('Authorization', 'Bearer token-client-1');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Test 10: Client cannot promote themselves or create admin profiles
  it('10. Client user cannot invoke user provisioning endpoint (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', 'Bearer token-client-1')
      .send({
        authUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'attacker@evil.com',
        firstName: 'Evil',
        lastName: 'User',
        role: UserRole.SUPER_ADMIN,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  // Test 11: Ordinary signup / manager cannot create a platform super-admin
  it('11. Organization Manager cannot elevate anyone to super_admin (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', 'Bearer token-manager-a')
      .send({
        authUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'escalated@agency-a.com',
        firstName: 'Escalated',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Only platform administrators can create super_admin users');
  });

  // Test 12: Bootstrap procedure refuses unauthorized or conflicting operations
  describe('12. Initial Super-Admin Bootstrap Procedure', () => {
    it('Refuses bootstrap when invalid bootstrap secret is provided', async () => {
      const res = await request(app)
        .post('/api/bootstrap/super-admin')
        .send({
          authUserId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'first-admin@platform.com',
          firstName: 'Root',
          lastName: 'Admin',
          bootstrapSecret: 'wrong-secret-token',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('Refuses bootstrap when a super_admin profile already exists in database (409 Conflict)', async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce({
        id: 'existing-admin-id',
        role: UserRole.SUPER_ADMIN,
      });

      const res = await request(app)
        .post('/api/bootstrap/super-admin')
        .send({
          authUserId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'second-admin@platform.com',
          firstName: 'Second',
          lastName: 'Admin',
          bootstrapSecret: 'hiredesk-local-bootstrap-secret',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toContain('Platform super-admin has already been bootstrapped');
    });

    it('Successfully bootstraps the very first platform super_admin when valid secret and 0 admins exist', async () => {
      (prisma.userProfile.findFirst as any).mockResolvedValueOnce(null); // 0 admins exist
      (prisma.userProfile.findUnique as any).mockResolvedValueOnce(null); // profile doesn't exist yet
      (prisma.userProfile.create as any).mockResolvedValueOnce({
        id: 'new-super-admin-id',
        authUserId: '123e4567-e89b-12d3-a456-426614174000',
        email: 'first-admin@platform.com',
        firstName: 'Root',
        lastName: 'Admin',
        fullName: 'Root Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      const res = await request(app)
        .post('/api/bootstrap/super-admin')
        .send({
          authUserId: '123e4567-e89b-12d3-a456-426614174000',
          email: 'first-admin@platform.com',
          firstName: 'Root',
          lastName: 'Admin',
          bootstrapSecret: 'hiredesk-local-bootstrap-secret',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profile.role).toBe(UserRole.SUPER_ADMIN);
      expect(res.body.data.profile.email).toBe('first-admin@platform.com');
    });
  });
});
