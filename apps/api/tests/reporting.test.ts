import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier } from '../src/services/auth.js';
import { UserRole } from '@hiredesk/shared';

const ORG_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const CLIENT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// Mock the database client
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    userProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    job: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    application: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    candidate: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    interview: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    stageHistory: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@hiredesk/database';

describe('Phase 8B: Advanced Analytics Reporting API', () => {
  let app: any;

  const mockRecruiter = {
    id: USER_A_ID,
    authUserId: 'auth-recruiter-a',
    email: 'recruiter@agency.com',
    role: UserRole.RECRUITER,
    organizationId: ORG_A_ID,
    organization: { id: ORG_A_ID, name: 'Agency Corp', slug: 'agency-corp' },
    clientId: null,
    client: null,
    isActive: true,
  };

  const mockClient = {
    id: 'client-user-uuid',
    authUserId: 'auth-client',
    email: 'client@clientcorp.com',
    role: UserRole.CLIENT,
    organizationId: ORG_A_ID,
    organization: { id: ORG_A_ID, name: 'Agency Corp', slug: 'agency-corp' },
    clientId: CLIENT_ID,
    client: { id: CLIENT_ID, name: 'Client Corp' },
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();

    setTokenVerifier(async (token: string) => {
      if (token === 'recruiter-token') return { authUserId: 'auth-recruiter-a' };
      if (token === 'client-token') return { authUserId: 'auth-client' };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.authUserId === 'auth-recruiter-a' || where.id === USER_A_ID) {
        return Promise.resolve(mockRecruiter);
      }
      if (where.authUserId === 'auth-client' || where.id === 'client-user-uuid') {
        return Promise.resolve(mockClient);
      }
      return Promise.resolve(null);
    });
  });

  describe('GET /api/analytics/reports/funnel', () => {
    it('returns conversion stages and aggregate counts from database', async () => {
      (prisma.application.count as any).mockResolvedValue(10);
      (prisma.application.groupBy as any).mockResolvedValue([
        { stage: 'Applied', _count: { id: 10 } },
        { stage: 'Screening', _count: { id: 7 } },
        { stage: 'Client Review', _count: { id: 5 } },
        { stage: 'Interview', _count: { id: 3 } },
        { stage: 'Offer', _count: { id: 2 } },
        { stage: 'Hired', _count: { id: 2 } },
      ]);

      const res = await request(app)
        .get('/api/analytics/reports/funnel')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalApplications).toBe(10);
      expect(res.body.data.stages).toBeInstanceOf(Array);
      const appliedStage = res.body.data.stages.find((s: any) => s.stage === 'Applied');
      expect(appliedStage.count).toBe(10);
    });
  });

  describe('GET /api/analytics/reports/time-to-hire', () => {
    it('calculates average and median days to hire correctly', async () => {
      const app1Applied = new Date('2026-02-15T00:00:00Z'); // 14 days
      const app2Applied = new Date('2026-02-01T00:00:00Z'); // 28 days

      (prisma.application.findMany as any)
        .mockResolvedValueOnce([
          {
            id: 'app-1',
            appliedAt: app1Applied,
            updatedAt: new Date('2026-03-01T00:00:00Z'),
            stageHistories: [
              {
                timestamp: new Date('2026-03-01T00:00:00Z'),
                nextStage: 'Hired',
              },
            ],
          },
          {
            id: 'app-2',
            appliedAt: app2Applied,
            updatedAt: new Date('2026-03-01T00:00:00Z'),
            stageHistories: [
              {
                timestamp: new Date('2026-03-01T00:00:00Z'),
                nextStage: 'Hired',
              },
            ],
          },
        ])
        .mockResolvedValueOnce([]); // allApplicationsWithHistories

      const res = await request(app)
        .get('/api/analytics/reports/time-to-hire')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalHired).toBe(2);
      expect(res.body.data.averageDaysToHire).toBe(21); // (14 + 28) / 2 = 21
    });

    it('returns 0 average days when no hires exist (honest zero state)', async () => {
      (prisma.application.findMany as any).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/analytics/reports/time-to-hire')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.data.totalHired).toBe(0);
      expect(res.body.data.averageDaysToHire).toBe(0);
      expect(res.body.data.medianDaysToHire).toBe(0);
    });
  });

  describe('GET /api/analytics/reports/sources', () => {
    it('aggregates candidate sources with hire conversion rate', async () => {
      (prisma.application.count as any).mockResolvedValue(15);
      (prisma.application.groupBy as any)
        .mockResolvedValueOnce([
          { source: 'linkedin', _count: { id: 10 } },
          { source: 'referral', _count: { id: 5 } },
        ])
        .mockResolvedValueOnce([
          { source: 'linkedin', _count: { id: 2 } },
          { source: 'referral', _count: { id: 3 } },
        ]);

      const res = await request(app)
        .get('/api/analytics/reports/sources')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalApplications).toBe(15);
      expect(res.body.data.sources).toHaveLength(2);
      const referralSource = res.body.data.sources.find((s: any) => s.source === 'referral');
      expect(referralSource.hiredCount).toBe(3);
    });
  });

  describe('GET /api/analytics/reports/recruiter-productivity', () => {
    it('returns recruiter productivity metrics for agency recruiters', async () => {
      (prisma.userProfile.findMany as any).mockResolvedValue([
        {
          id: USER_A_ID,
          firstName: 'Alice',
          lastName: 'Recruiter',
          email: 'alice@agency.com',
          role: 'recruiter',
        },
      ]);

      (prisma.stageHistory.count as any).mockResolvedValue(4);
      (prisma.interview.count as any).mockResolvedValue(5);
      (prisma.activityLog.count as any).mockResolvedValue(2);

      const res = await request(app)
        .get('/api/analytics/reports/recruiter-productivity')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recruiters).toHaveLength(1);
      expect(res.body.data.recruiters[0].stageTransitionsCount).toBe(4);
      expect(res.body.data.recruiters[0].interviewsScheduledCount).toBe(5);
      expect(res.body.data.recruiters[0].notesLoggedCount).toBe(2);
    });

    it('denies client access to recruiter productivity report with 403', async () => {
      const res = await request(app)
        .get('/api/analytics/reports/recruiter-productivity')
        .set('Authorization', 'Bearer client-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/analytics/reports/job-outcomes', () => {
    it('returns job performance metrics with days open and time to fill', async () => {
      (prisma.job.findMany as any).mockResolvedValue([
        {
          id: 'job-1',
          jobCode: 'JOB-101',
          title: 'Senior Backend Engineer',
          status: 'filled',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          client: { id: CLIENT_ID, name: 'Acme Corp' },
          applications: [
            { id: 'app-1', stage: 'Hired' },
            { id: 'app-2', stage: 'Rejected' },
          ],
        },
      ]);

      const res = await request(app)
        .get('/api/analytics/reports/job-outcomes')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs).toHaveLength(1);
      expect(res.body.data.jobs[0].totalApplications).toBe(2);
      expect(res.body.data.jobs[0].hiredCount).toBe(1);
      expect(res.body.data.jobs[0].rejectedCount).toBe(1);
    });
  });
});
