import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { UserRole, ApplicationStage, JobStatus } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    userProfile: {
      findUnique: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    candidate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    stageHistory: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
  };
});

import { prisma } from '@hiredesk/database';

describe('Phase 5: Pipeline, Stage Transitions, Notes & Candidate Profiles', () => {
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

  const sampleJob = {
    id: 'job-1-uuid',
    organizationId: 'org-a-uuid',
    clientId: 'client-1-uuid',
    jobCode: 'JOB-1001',
    title: 'Senior Backend Engineer',
    status: JobStatus.PUBLISHED,
    client: { id: 'client-1-uuid', name: 'Acme Corp' },
  };

  const sampleCandidate = {
    id: 'cand-1-uuid',
    organizationId: 'org-a-uuid',
    candidateCode: 'CAND-5001',
    normalizedEmail: 'jane@example.com',
    name: 'Jane Doe',
    phone: '+15551234567',
    location: 'San Francisco, CA',
    country: 'United States',
    skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
    education: [],
    experience: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleApplication = {
    id: 'app-1-uuid',
    candidateId: 'cand-1-uuid',
    jobId: 'job-1-uuid',
    organizationId: 'org-a-uuid',
    clientId: 'client-1-uuid',
    stage: ApplicationStage.APPLIED,
    source: 'career_portal',
    appliedAt: new Date(),
    updatedAt: new Date(),
    recruiterNotes: 'Top candidate from referral',
    clientFeedback: 'Looking forward to interview',
    job: sampleJob,
    candidate: sampleCandidate,
    resumes: [
      {
        id: 'res-1-uuid',
        originalFilename: 'JaneDoe_Resume.pdf',
        fileSize: 102400,
        contentType: 'application/pdf',
        storagePath: 'org-a-uuid/cand-1-uuid/res-1.pdf',
        uploadedAt: new Date(),
      },
    ],
    stageHistories: [
      {
        id: 'sh-1-uuid',
        previousStage: 'Applied',
        nextStage: 'Applied',
        reason: 'Initial application',
        timestamp: new Date(),
        actor: { id: 'user-recruiter-a', fullName: 'Alice Apex', role: 'recruiter' },
      },
    ],
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

  // 1. Pipeline grouping
  it('1. GET /api/jobs/:jobId/pipeline returns applications grouped by stage for recruiter', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJob);
    (prisma.application.findMany as any).mockResolvedValueOnce([sampleApplication]);

    const res = await request(app)
      .get(`/api/jobs/${sampleJob.id}/pipeline`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.job.jobCode).toBe('JOB-1001');
    expect(data.totalApplications).toBe(1);
    expect(data.stages[ApplicationStage.APPLIED]).toHaveLength(1);
    expect(data.stages[ApplicationStage.APPLIED][0].recruiterNotes).toBe('Top candidate from referral');
  });

  it('2. GET /api/jobs/:jobId/pipeline redacts recruiterNotes for client user', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJob);
    (prisma.application.findMany as any).mockResolvedValueOnce([sampleApplication]);

    const res = await request(app)
      .get(`/api/jobs/${sampleJob.id}/pipeline`)
      .set('Authorization', 'Bearer token-client-1');

    expect(res.status).toBe(200);
    const appItem = res.body.data.stages[ApplicationStage.APPLIED][0];
    expect(appItem.clientFeedback).toBe('Looking forward to interview');
    expect(appItem.recruiterNotes).toBeUndefined(); // Strictly redacted!
  });

  it('3. GET /api/jobs/:jobId/pipeline returns 404 for cross-tenant job', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJob);

    const res = await request(app)
      .get(`/api/jobs/${sampleJob.id}/pipeline`)
      .set('Authorization', 'Bearer token-recruiter-b');

    expect(res.status).toBe(404);
  });

  // 2. Stage transitions
  it('4. POST /api/applications/:id/stage transitions stage atomically with StageHistory and ActivityLog', async () => {
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    // Mock interactive transaction
    (prisma.$transaction as any).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        application: {
          update: vi.fn().mockResolvedValue({
            ...sampleApplication,
            stage: ApplicationStage.SHORTLISTED,
          }),
        },
        stageHistory: {
          create: vi.fn().mockResolvedValue({ id: 'sh-new-uuid' }),
        },
        userProfile: {
          findUnique: vi.fn().mockResolvedValue({ id: 'prof-recruiter-a' }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({ id: 'act-new-uuid' }),
        },
      };

      return txCallback(mockTx);
    });

    // Mock fetch after update
    (prisma.application.findUnique as any).mockResolvedValueOnce({
      ...sampleApplication,
      stage: ApplicationStage.SHORTLISTED,
    });

    const res = await request(app)
      .post(`/api/applications/${sampleApplication.id}/stage`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        stage: ApplicationStage.SHORTLISTED,
        reason: 'Passed technical resume review',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stage).toBe(ApplicationStage.SHORTLISTED);
  });

  it('5. POST /api/applications/:id/stage fails safely if database transaction fails', async () => {
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    (prisma.$transaction as any).mockRejectedValueOnce(new Error('Transaction Aborted: deadlock'));

    const res = await request(app)
      .post(`/api/applications/${sampleApplication.id}/stage`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        stage: ApplicationStage.SHORTLISTED,
      });

    expect(res.status).toBe(500);
  });

  it('6. POST /api/applications/:id/stage rejects invalid stage string with 400', async () => {
    const res = await request(app)
      .post(`/api/applications/${sampleApplication.id}/stage`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        stage: 'INVALID_SUPER_STAGE',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('7. Client user cannot transition application unless currently in Client Review', async () => {
    // Current stage is Applied (not Client Review)
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    const res = await request(app)
      .post(`/api/applications/${sampleApplication.id}/stage`)
      .set('Authorization', 'Bearer token-client-1')
      .send({
        stage: ApplicationStage.SHORTLISTED,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('Client users can only transition');
  });

  // 3. Notes separation
  it('8. PATCH /api/applications/:id/notes updates recruiterNotes for recruiter', async () => {
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    (prisma.$transaction as any).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        application: {
          update: vi.fn().mockResolvedValue({
            ...sampleApplication,
            recruiterNotes: 'Updated secret internal notes',
          }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({ id: 'act-notes' }),
        },
      };
      return txCallback(mockTx);
    });

    (prisma.application.findUnique as any).mockResolvedValueOnce({
      ...sampleApplication,
      recruiterNotes: 'Updated secret internal notes',
    });

    const res = await request(app)
      .patch(`/api/applications/${sampleApplication.id}/notes`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        recruiterNotes: 'Updated secret internal notes',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.recruiterNotes).toBe('Updated secret internal notes');
  });

  it('9. PATCH /api/applications/:id/notes forbids client user from setting recruiterNotes', async () => {
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    const res = await request(app)
      .patch(`/api/applications/${sampleApplication.id}/notes`)
      .set('Authorization', 'Bearer token-client-1')
      .send({
        recruiterNotes: 'Sneaky client attempt to write internal note',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('10. PATCH /api/applications/:id/notes allows client user to submit clientFeedback', async () => {
    (prisma.application.findUnique as any).mockResolvedValueOnce(sampleApplication);

    (prisma.$transaction as any).mockImplementationOnce(async (txCallback: any) => {
      const mockTx = {
        application: {
          update: vi.fn().mockResolvedValue({
            ...sampleApplication,
            clientFeedback: 'Candidate looks strong for onsite',
          }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({ id: 'act-feedback' }),
        },
      };
      return txCallback(mockTx);
    });

    (prisma.application.findUnique as any).mockResolvedValueOnce({
      ...sampleApplication,
      clientFeedback: 'Candidate looks strong for onsite',
    });

    const res = await request(app)
      .patch(`/api/applications/${sampleApplication.id}/notes`)
      .set('Authorization', 'Bearer token-client-1')
      .send({
        clientFeedback: 'Candidate looks strong for onsite',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.clientFeedback).toBe('Candidate looks strong for onsite');
    expect(res.body.data.recruiterNotes).toBeUndefined(); // Redacted in output
  });

  // 4. Candidate Profile
  it('11. GET /api/candidates/:id returns profile and multi-job applications for recruiter', async () => {
    (prisma.candidate.findUnique as any).mockResolvedValueOnce({
      ...sampleCandidate,
      resumes: sampleApplication.resumes,
      applications: [
        {
          ...sampleApplication,
          job: {
            id: 'job-1-uuid',
            jobCode: 'JOB-1001',
            title: 'Senior Backend Engineer',
            status: JobStatus.PUBLISHED,
            clientId: 'client-1-uuid',
            client: { name: 'Acme Corp' },
          },
        },
        {
          ...sampleApplication,
          id: 'app-2-uuid',
          jobId: 'job-2-uuid',
          stage: ApplicationStage.SHORTLISTED,
          recruiterNotes: 'Applied also for frontend',
          job: {
            id: 'job-2-uuid',
            jobCode: 'JOB-1002',
            title: 'Frontend Engineer',
            status: JobStatus.PUBLISHED,
            clientId: 'client-2-uuid',
            client: { name: 'Beta Tech' },
          },
        },
      ],
    });

    const res = await request(app)
      .get(`/api/candidates/${sampleCandidate.id}`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.candidateCode).toBe('CAND-5001');
    expect(data.applications).toHaveLength(2); // Recruiter sees both applications
    expect(data.applications[0].recruiterNotes).toBe('Top candidate from referral');
    expect(data.applications[1].recruiterNotes).toBe('Applied also for frontend');
  });

  it('12. GET /api/candidates/:id scopes applications and redacts recruiterNotes for client user', async () => {
    (prisma.candidate.findUnique as any).mockResolvedValueOnce({
      ...sampleCandidate,
      resumes: sampleApplication.resumes,
      applications: [
        {
          ...sampleApplication,
          clientId: 'client-1-uuid', // Belongs to client-1
          job: {
            id: 'job-1-uuid',
            jobCode: 'JOB-1001',
            title: 'Senior Backend Engineer',
            status: JobStatus.PUBLISHED,
            clientId: 'client-1-uuid',
            client: { name: 'Acme Corp' },
          },
        },
        {
          ...sampleApplication,
          id: 'app-2-uuid',
          clientId: 'client-2-uuid', // Belongs to different client!
          job: {
            id: 'job-2-uuid',
            jobCode: 'JOB-1002',
            title: 'Frontend Engineer',
            status: JobStatus.PUBLISHED,
            clientId: 'client-2-uuid',
            client: { name: 'Beta Tech' },
          },
        },
      ],
    });

    const res = await request(app)
      .get(`/api/candidates/${sampleCandidate.id}`)
      .set('Authorization', 'Bearer token-client-1');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.applications).toHaveLength(1); // Client only sees application for client-1
    expect(data.applications[0].job.jobCode).toBe('JOB-1001');
    expect(data.applications[0].recruiterNotes).toBeUndefined(); // Strictly redacted!
  });

  it('13. GET /api/candidates lists candidates with search filter and pagination', async () => {
    (prisma.candidate.count as any).mockResolvedValueOnce(1);
    (prisma.candidate.findMany as any).mockResolvedValueOnce([
      {
        ...sampleCandidate,
        _count: { applications: 2 },
      },
    ]);

    const res = await request(app)
      .get('/api/candidates?search=Jane&page=1&limit=10')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].candidateCode).toBe('CAND-5001');
    expect(res.body.data[0].applicationsCount).toBe(2);
    expect(res.body.meta.total).toBe(1);
  });
});
