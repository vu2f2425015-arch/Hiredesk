import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { UserRole, JobStatus, ApplicationStage } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    job: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    candidate: {
      count: vi.fn(),
    },
    application: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
  };
});

import { prisma } from '@hiredesk/database';

describe('Phase 5: Recruiter Dashboard Analytics API', () => {
  const app = createApp();

  const mockUsers = {
    recruiterOrgA: {
      id: 'user-recruiter-a',
      authUserId: 'auth-recruiter-a',
      email: 'recruiter@apex.local',
      firstName: 'Alice',
      lastName: 'Apex',
      fullName: 'Alice Apex',
      role: UserRole.RECRUITER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency', slug: 'apex-agency' },
      clientId: null,
      client: null,
      isActive: true,
    },
    recruiterOrgB: {
      id: 'user-recruiter-b',
      authUserId: 'auth-recruiter-b',
      email: 'recruiter@beta.local',
      firstName: 'Bob',
      lastName: 'Beta',
      fullName: 'Bob Beta',
      role: UserRole.RECRUITER,
      organizationId: 'org-b-uuid',
      organization: { id: 'org-b-uuid', name: 'Beta Agency', slug: 'beta-agency' },
      clientId: null,
      client: null,
      isActive: true,
    },
    clientUser1: {
      id: 'user-client-1',
      authUserId: 'auth-client-1',
      email: 'hiring@acme.local',
      firstName: 'Charlie',
      lastName: 'Client',
      fullName: 'Charlie Client',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency', slug: 'apex-agency' },
      clientId: 'client-1-uuid',
      client: { id: 'client-1-uuid', name: 'Acme Corp' },
      isActive: true,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetTokenVerifier();

    setTokenVerifier(async (token: string) => {
      if (token === 'token-recruiter-a') return { authUserId: 'auth-recruiter-a', email: 'recruiter@apex.local' };
      if (token === 'token-recruiter-b') return { authUserId: 'auth-recruiter-b', email: 'recruiter@beta.local' };
      if (token === 'token-client-1') return { authUserId: 'auth-client-1', email: 'hiring@acme.local' };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: { where: { authUserId?: string } }) => {
      if (where.authUserId === 'auth-recruiter-a') return Promise.resolve(mockUsers.recruiterOrgA);
      if (where.authUserId === 'auth-recruiter-b') return Promise.resolve(mockUsers.recruiterOrgB);
      if (where.authUserId === 'auth-client-1') return Promise.resolve(mockUsers.clientUser1);
      return Promise.resolve(null);
    });
  });

  it('1. GET /api/analytics/dashboard returns database-computed metrics for recruiter', async () => {
    // Mock jobs counts (total, published, draft, closed)
    (prisma.job.count as any)
      .mockResolvedValueOnce(8) // total
      .mockResolvedValueOnce(5) // published
      .mockResolvedValueOnce(2) // draft
      .mockResolvedValueOnce(1); // closed

    // Mock candidate count
    (prisma.candidate.count as any).mockResolvedValueOnce(18);

    // Mock applications count
    (prisma.application.count as any)
      .mockResolvedValueOnce(35) // total
      .mockResolvedValueOnce(7); // recent 7 days

    // Mock applications groupBy stage
    (prisma.application.groupBy as any).mockResolvedValueOnce([
      { stage: ApplicationStage.APPLIED, _count: { id: 10 } },
      { stage: ApplicationStage.SHORTLISTED, _count: { id: 8 } },
      { stage: ApplicationStage.INTERVIEW, _count: { id: 6 } },
      { stage: ApplicationStage.SELECTED, _count: { id: 4 } },
      { stage: ApplicationStage.HIRED, _count: { id: 3 } },
      { stage: ApplicationStage.REJECTED, _count: { id: 4 } },
    ]);

    // Mock jobs approaching deadline
    const now = new Date();
    const deadline1 = new Date(now.getTime() + 3 * 86400000);
    (prisma.job.findMany as any).mockResolvedValueOnce([
      {
        id: 'job-1',
        jobCode: 'JOB-1001',
        title: 'Lead Architect',
        status: JobStatus.PUBLISHED,
        deadline: deadline1,
        client: { id: 'client-1-uuid', name: 'Acme Corp' },
      },
    ]);

    // Mock recent activity log
    (prisma.activityLog.findMany as any).mockResolvedValueOnce([
      {
        id: 'act-1',
        action: 'stage_transition',
        entityType: 'application',
        entityId: 'app-1',
        timestamp: now,
        details: { fromStage: 'Applied', toStage: 'Shortlisted' },
        actor: {
          id: 'user-recruiter-a',
          fullName: 'Alice Apex',
          role: 'recruiter',
        },
      },
    ]);

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;

    expect(data.jobs.total).toBe(8);
    expect(data.jobs.active).toBe(5);
    expect(data.jobs.draft).toBe(2);
    expect(data.jobs.closed).toBe(1);

    expect(data.candidates.total).toBe(18);
    expect(data.applications.total).toBe(35);
    expect(data.applications.recent).toBe(7);

    expect(data.stages[ApplicationStage.SHORTLISTED]).toBe(8);
    expect(data.stages[ApplicationStage.INTERVIEW]).toBe(6);
    expect(data.stages[ApplicationStage.HIRED]).toBe(3);

    expect(data.jobsApproachingDeadline).toHaveLength(1);
    expect(data.jobsApproachingDeadline[0].jobCode).toBe('JOB-1001');

    expect(data.recentActivity).toHaveLength(1);
    expect(data.recentActivity[0].action).toBe('stage_transition');
    expect(data.recentActivity[0].actor.fullName).toBe('Alice Apex');
  });

  it('2. GET /api/analytics/dashboard returns honest zeros for empty organization', async () => {
    (prisma.job.count as any)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    (prisma.candidate.count as any).mockResolvedValueOnce(0);
    (prisma.application.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    (prisma.application.groupBy as any).mockResolvedValueOnce([]);
    (prisma.job.findMany as any).mockResolvedValueOnce([]);
    (prisma.activityLog.findMany as any).mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    const data = res.body.data;

    expect(data.jobs.total).toBe(0);
    expect(data.jobs.active).toBe(0);
    expect(data.jobs.draft).toBe(0);
    expect(data.jobs.closed).toBe(0);

    expect(data.candidates.total).toBe(0);
    expect(data.applications.total).toBe(0);
    expect(data.applications.recent).toBe(0);

    expect(data.stages[ApplicationStage.APPLIED]).toBe(0);
    expect(data.stages[ApplicationStage.HIRED]).toBe(0);
    expect(data.jobsApproachingDeadline).toEqual([]);
    expect(data.recentActivity).toEqual([]);
  });

  it('3. GET /api/analytics/dashboard isolates metrics by organization', async () => {
    (prisma.job.count as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      if (where.status === JobStatus.PUBLISHED) return Promise.resolve(3);
      return Promise.resolve(4);
    });

    (prisma.candidate.count as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      return Promise.resolve(5);
    });

    (prisma.application.count as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      return Promise.resolve(10);
    });

    (prisma.application.groupBy as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      return Promise.resolve([]);
    });

    (prisma.job.findMany as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      return Promise.resolve([]);
    });

    (prisma.activityLog.findMany as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-b-uuid');
      return Promise.resolve([]);
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', 'Bearer token-recruiter-b');

    expect(res.status).toBe(200);
    expect(res.body.data.jobs.active).toBe(3);
    expect(res.body.data.candidates.total).toBe(5);
  });

  it('4. GET /api/analytics/dashboard scopes metrics to client role and hides internal activity', async () => {
    (prisma.job.count as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-a-uuid');
      expect(where.clientId).toBe('client-1-uuid');
      if (where.status === JobStatus.PUBLISHED) return Promise.resolve(2);
      return Promise.resolve(3);
    });

    // For client, unique candidates is grouped from applications
    (prisma.application.groupBy as any)
      .mockImplementationOnce(({ where }: any) => {
        expect(where.organizationId).toBe('org-a-uuid');
        expect(where.clientId).toBe('client-1-uuid');
        return Promise.resolve([
          { candidateId: 'cand-1', _count: { id: 1 } },
          { candidateId: 'cand-2', _count: { id: 2 } },
        ]);
      })
      .mockImplementationOnce(({ where }: any) => {
        expect(where.organizationId).toBe('org-a-uuid');
        expect(where.clientId).toBe('client-1-uuid');
        return Promise.resolve([{ stage: ApplicationStage.CLIENT_REVIEW, _count: { id: 4 } }]);
      });

    (prisma.application.count as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-a-uuid');
      expect(where.clientId).toBe('client-1-uuid');
      return Promise.resolve(4);
    });

    (prisma.job.findMany as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-a-uuid');
      expect(where.clientId).toBe('client-1-uuid');
      return Promise.resolve([]);
    });

    (prisma.activityLog.findMany as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-a-uuid');
      // Visibility must be client_visible for client role!
      expect(where.visibility).toBe('client_visible');
      return Promise.resolve([
        {
          id: 'act-client-1',
          action: 'stage_transition',
          entityType: 'application',
          entityId: 'app-1',
          timestamp: new Date(),
          details: { fromStage: 'Screening', toStage: 'Client Review' },
          actor: null,
        },
      ]);
    });

    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', 'Bearer token-client-1');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.jobs.active).toBe(2);
    expect(data.candidates.total).toBe(2); // exactly 2 unique candidates
    expect(data.applications.total).toBe(4);
    expect(data.recentActivity).toHaveLength(1);
    expect(data.recentActivity[0].id).toBe('act-client-1');
  });

  it('5. GET /api/analytics/dashboard rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});
