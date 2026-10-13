import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { clearProfileCache } from '../src/middleware/auth.js';
import { UserRole, InboundStatus, JobStatus } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) =>
      cb({
        application: {
          create: vi.fn(async (args: any) => ({ id: 'app-assigned-uuid', ...args.data })),
        },
        stageHistory: {
          create: vi.fn(async (args: any) => ({ id: 'stage-assigned-uuid', ...args.data })),
        },
        activityLog: {
          create: vi.fn(async (args: any) => ({ id: 'log-assigned-uuid', ...args.data })),
        },
        inboundApplication: {
          update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
        },
      })
    ),
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    inboundApplication: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    candidate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
    allocateNextCandidateCode: vi.fn().mockResolvedValue('CAND-1005'),
    setCandidateCodeAllocator: vi.fn(),
  };
});

import { prisma } from '@hiredesk/database';

describe('Inbound Applications Queue & Manual Assignment API', () => {
  const app = createApp();

  const mockUsers = {
    superAdmin: {
      id: 'profile-super-admin',
      authUserId: 'auth-super-admin',
      email: 'admin@platform.local',
      role: UserRole.SUPER_ADMIN,
      organizationId: null,
      clientId: null,
      isActive: true,
    },
    managerOrgA: {
      id: 'profile-manager-org-a',
      authUserId: 'auth-manager-org-a',
      email: 'manager@orga.local',
      role: UserRole.MANAGER,
      organizationId: 'org-a-uuid',
      clientId: null,
      isActive: true,
    },
    managerOrgB: {
      id: 'profile-manager-org-b',
      authUserId: 'auth-manager-org-b',
      email: 'manager@orgb.local',
      role: UserRole.MANAGER,
      organizationId: 'org-b-uuid',
      clientId: null,
      isActive: true,
    },
    clientUser: {
      id: 'profile-client-1',
      authUserId: 'auth-client-1',
      email: 'client@client.local',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      clientId: 'client-1-uuid',
      isActive: true,
    },
  };

  beforeEach(() => {
    resetTokenVerifier();
    clearProfileCache();
    vi.clearAllMocks();

    setTokenVerifier(async (token: string) => {
      if (token === 'token-super-admin') return { authUserId: mockUsers.superAdmin.authUserId, email: mockUsers.superAdmin.email };
      if (token === 'token-manager-a') return { authUserId: mockUsers.managerOrgA.authUserId, email: mockUsers.managerOrgA.email };
      if (token === 'token-manager-b') return { authUserId: mockUsers.managerOrgB.authUserId, email: mockUsers.managerOrgB.email };
      if (token === 'token-client') return { authUserId: mockUsers.clientUser.authUserId, email: mockUsers.clientUser.email };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(async (args: any) => {
      const authId = args.where.authUserId;
      if (authId === mockUsers.superAdmin.authUserId) return mockUsers.superAdmin;
      if (authId === mockUsers.managerOrgA.authUserId) return mockUsers.managerOrgA;
      if (authId === mockUsers.managerOrgB.authUserId) return mockUsers.managerOrgB;
      if (authId === mockUsers.clientUser.authUserId) return mockUsers.clientUser;
      return null;
    });
  });

  describe('GET /api/admin/inbound-applications', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/inbound-applications');
      expect(res.status).toBe(401);
    });

    it('rejects client role with 403', async () => {
      const res = await request(app)
        .get('/api/admin/inbound-applications')
        .set('Authorization', 'Bearer token-client');
      expect(res.status).toBe(403);
    });

    it('allows super_admin to list all records without tenant restriction', async () => {
      (prisma.inboundApplication.count as any).mockResolvedValue(2);
      (prisma.inboundApplication.findMany as any).mockResolvedValue([
        {
          id: 'inbound-1',
          mailboxId: 'box-1',
          uidValidity: BigInt(100),
          uid: BigInt(1),
          subject: 'No Code Email',
          senderEmail: 'anon@test.com',
          status: InboundStatus.UNMATCHED,
          failureReason: 'no_job_code',
          matchedOrgId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          receivedAt: new Date(),
        },
      ]);

      const res = await request(app)
        .get('/api/admin/inbound-applications')
        .set('Authorization', 'Bearer token-super-admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      // Verify BigInt serialization
      expect(res.body.data.items[0].uid).toBe('1');
      expect(res.body.data.items[0].uidValidity).toBe('100');

      // Verify findMany was called with no matchedOrgId filter for super_admin
      expect(prisma.inboundApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });

    it('scopes listing to organizationId for agency managers', async () => {
      (prisma.inboundApplication.count as any).mockResolvedValue(1);
      (prisma.inboundApplication.findMany as any).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/admin/inbound-applications')
        .set('Authorization', 'Bearer token-manager-a');

      expect(res.status).toBe(200);
      expect(prisma.inboundApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { matchedOrgId: 'org-a-uuid' },
        })
      );
    });
  });

  describe('GET /api/admin/inbound-applications/:id', () => {
    it('returns 404 non-disclosing error when manager requests another tenant message', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-org-b',
        matchedOrgId: 'org-b-uuid', // belongs to Org B
        subject: 'Confidential Application',
        status: InboundStatus.UNMATCHED,
      });

      const res = await request(app)
        .get('/api/admin/inbound-applications/inbound-org-b')
        .set('Authorization', 'Bearer token-manager-a'); // Manager of Org A

      expect(res.status).toBe(404);
    });

    it('allows super_admin to view unassigned message with no matchedOrgId', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-unassigned',
        matchedOrgId: null,
        uidValidity: BigInt(50),
        uid: BigInt(12),
        subject: 'General Application',
        status: InboundStatus.UNMATCHED,
        createdAt: new Date(),
        updatedAt: new Date(),
        receivedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/admin/inbound-applications/inbound-unassigned')
        .set('Authorization', 'Bearer token-super-admin');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('inbound-unassigned');
      expect(res.body.data.uid).toBe('12');
    });
  });

  describe('POST /api/admin/inbound-applications/:id/assign', () => {
    it('blocks ordinary manager from assigning an unassigned platform message', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-unassigned',
        matchedOrgId: null,
        status: InboundStatus.UNMATCHED,
      });

      const res = await request(app)
        .post('/api/admin/inbound-applications/inbound-unassigned/assign')
        .set('Authorization', 'Bearer token-manager-a')
        .send({ jobId: '123e4567-e89b-12d3-a456-426614174000' });

      expect(res.status).toBe(403);
    });

    it('blocks manager from assigning to a job from another organization', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-org-a',
        matchedOrgId: 'org-a-uuid',
        status: InboundStatus.UNMATCHED,
      });

      (prisma.job.findUnique as any).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        jobCode: 'JOB-2001',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-b-uuid', // Cross-tenant job!
        clientId: 'client-b-uuid',
      });

      const res = await request(app)
        .post('/api/admin/inbound-applications/inbound-org-a/assign')
        .set('Authorization', 'Bearer token-manager-a')
        .send({ jobId: '123e4567-e89b-12d3-a456-426614174000' });

      expect(res.status).toBe(404);
    });

    it('super_admin successfully assigns unmatched email to a live published job', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-to-assign',
        senderEmail: 'david@domain.com',
        senderName: 'David Miller',
        matchedOrgId: null,
        status: InboundStatus.UNMATCHED,
      });

      (prisma.job.findUnique as any).mockResolvedValue({
        id: '123e4567-e89b-12d3-a456-426614174000',
        jobCode: 'JOB-1001',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
      });

      (prisma.candidate.findUnique as any).mockResolvedValue(null);
      (prisma.candidate.create as any).mockResolvedValue({
        id: 'cand-david-uuid',
        candidateCode: 'CAND-1005',
        normalizedEmail: 'david@domain.com',
      });

      (prisma.application.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/admin/inbound-applications/inbound-to-assign/assign')
        .set('Authorization', 'Bearer token-super-admin')
        .send({ jobId: '123e4567-e89b-12d3-a456-426614174000' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/inbound-applications/:id/ignore', () => {
    it('requires an explicit reason to ignore an email', async () => {
      const res = await request(app)
        .post('/api/admin/inbound-applications/inbound-1/ignore')
        .set('Authorization', 'Bearer token-super-admin')
        .send({});

      expect(res.status).toBe(400);
    });

    it('super_admin marks inbound record as ignored with audit reason', async () => {
      (prisma.inboundApplication.findUnique as any).mockResolvedValue({
        id: 'inbound-spam',
        matchedOrgId: 'org-a-uuid',
        status: InboundStatus.UNMATCHED,
      });
      (prisma.inboundApplication.update as any).mockResolvedValue({
        id: 'inbound-spam',
        status: InboundStatus.IGNORED,
        failureReason: 'Marketing spam newsletter',
      });

      const res = await request(app)
        .post('/api/admin/inbound-applications/inbound-spam/ignore')
        .set('Authorization', 'Bearer token-super-admin')
        .send({ reason: 'Marketing spam newsletter' });

      expect(res.status).toBe(200);
      expect(prisma.inboundApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: InboundStatus.IGNORED,
            failureReason: 'Marketing spam newsletter',
          }),
        })
      );
    });
  });
});
