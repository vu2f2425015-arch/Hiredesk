import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier } from '../src/services/auth.js';
import { UserRole } from '@hiredesk/shared';

const ORG_A_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const APP_ID_1 = '22222222-2222-2222-2222-222222222222';
const CAND_ID_1 = '33333333-3333-3333-3333-333333333333';
const JOB_ID_1 = '44444444-4444-4444-4444-444444444444';

// Mock the database client
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    userProfile: {
      findUnique: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@hiredesk/database';

describe('Phase 8C: AI Recruiter Decision Support API', () => {
  let app: any;
  const originalEnv = process.env;

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
    clientId: 'client-uuid',
    client: { id: 'client-uuid', name: 'Client Corp' },
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

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

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /api/ai-recruiter/status', () => {
    it('honestly reports deterministic baseline when no external AI provider is configured', async () => {
      const res = await request(app)
        .get('/api/ai-recruiter/status')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.providerConfigured).toBe(false);
      expect(res.body.data.providerName).toBe('deterministic_baseline');
      expect(res.body.data.model).toBeNull();
      expect(res.body.data.message).toContain('No external AI provider configured');
      expect(res.body.data.capabilities).toContain('deterministic_skill_overlap');
    });

    it('reports external provider active when GEMINI_API_KEY is configured', async () => {
      process.env.GEMINI_API_KEY = 'fake-gemini-key-for-test';

      const res = await request(app)
        .get('/api/ai-recruiter/status')
        .set('Authorization', 'Bearer recruiter-token');

      expect(res.status).toBe(200);
      expect(res.body.data.providerConfigured).toBe(true);
      expect(res.body.data.providerName).toBe('google_gemini');
      expect(res.body.data.model).toBe('gemini-1.5-flash');
    });

    it('denies client role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/ai-recruiter/status')
        .set('Authorization', 'Bearer client-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/ai-recruiter/match', () => {
    it('evaluates application match using deterministic skill overlap with zero fabricated scores', async () => {
      (prisma.application.findFirst as any).mockResolvedValueOnce({
        id: APP_ID_1,
        organizationId: ORG_A_ID,
        candidateId: CAND_ID_1,
        jobId: JOB_ID_1,
        candidate: {
          id: CAND_ID_1,
          name: 'Sarah Connor',
          skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
          location: 'San Francisco, CA',
          experience: [
            { role: 'Senior Engineer', company: 'Tech Inc', years: 3 },
            { role: 'Software Engineer', company: 'Startup Co', years: 2 },
          ],
        },
        job: {
          id: JOB_ID_1,
          title: 'Senior Full Stack Engineer',
          skills: ['TypeScript', 'React', 'Node.js', 'GraphQL'],
          description: 'Looking for 3+ years experience with modern TypeScript and React.',
          client: { id: 'client-1', name: 'Acme Corp' },
        },
        resumes: [],
      });

      const res = await request(app)
        .post('/api/ai-recruiter/match')
        .set('Authorization', 'Bearer recruiter-token')
        .send({ applicationId: APP_ID_1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.provider).toBe('deterministic_baseline');
      expect(data.model).toBeNull();
      expect(data.limitationNotice).toBe(
        'No external AI provider configured. Evaluated using deterministic skill/requirement overlap baseline.'
      );

      // Verify exact skill math (3 matched out of 4 required = 0.75)
      expect(data.skillsMatch.matchedSkills).toEqual(['TypeScript', 'React', 'Node.js']);
      expect(data.skillsMatch.missingSkills).toEqual(['GraphQL']);
      expect(data.skillsMatch.overlapRatio).toBe(0.75);

      // Verify human-in-the-loop governance
      expect(data.decisionSupportDisclaimer).toContain('It does not automate any hiring or rejection decision');
      expect(data.matchTier).toBe('Strong Fit');
      expect(data.strengths.length).toBeGreaterThan(0);
      expect(data.gaps.length).toBeGreaterThan(0);
      expect(data.interviewFocusAreas.length).toBeGreaterThan(0);
    });

    it('accurately identifies low overlap when skills do not match', async () => {
      (prisma.application.findFirst as any).mockResolvedValueOnce({
        id: APP_ID_1,
        organizationId: ORG_A_ID,
        candidateId: CAND_ID_1,
        jobId: JOB_ID_1,
        candidate: {
          id: CAND_ID_1,
          name: 'Bob Baker',
          skills: ['Salesforce', 'HubSpot'],
          experience: [],
        },
        job: {
          id: JOB_ID_1,
          title: 'Staff Kubernetes Engineer',
          skills: ['Kubernetes', 'Go', 'Terraform', 'Rust'],
          description: 'Requires deep infrastructure background',
          client: { id: 'client-1', name: 'Cloud Co' },
        },
        resumes: [],
      });

      const res = await request(app)
        .post('/api/ai-recruiter/match')
        .set('Authorization', 'Bearer recruiter-token')
        .send({ applicationId: APP_ID_1 });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.skillsMatch.overlapRatio).toBe(0);
      expect(data.skillsMatch.matchedSkills).toEqual([]);
      expect(data.skillsMatch.missingSkills).toHaveLength(4);
      expect(data.matchTier).toBe('Low Overlap');
    });

    it('returns non-disclosing 404 for cross-organization application', async () => {
      (prisma.application.findFirst as any).mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/ai-recruiter/match')
        .set('Authorization', 'Bearer recruiter-token')
        .send({ applicationId: APP_ID_1 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('denies client user role with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/ai-recruiter/match')
        .set('Authorization', 'Bearer client-token')
        .send({ applicationId: APP_ID_1 });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
