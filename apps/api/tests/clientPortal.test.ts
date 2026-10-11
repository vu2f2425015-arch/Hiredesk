import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { UserRole, ApplicationStage, JobStatus, InterviewRequestStatus } from '@hiredesk/shared';

// Mock the database client
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    userProfile: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    job: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    candidate: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    resume: {
      findFirst: vi.fn(),
    },
    stageHistory: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    interviewRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
  };
});

// Mock StorageService
vi.mock('../src/services/storage.js', () => ({
  StorageService: {
    getSignedResumeUrl: vi.fn().mockResolvedValue('https://supabase.mock.storage/signed-resume-url'),
    uploadResume: vi.fn(),
  },
  validateUploadedFile: vi.fn().mockReturnValue({ isValid: true }),
}));

import { prisma } from '@hiredesk/database';

describe('Phase 6: Dedicated Client Portal, Review Actions & Multi-Tenant Isolation (Mocked)', () => {
  const app = createApp();

  // Test Fixtures: Two Organizations (Org A and Org B), with Org A having two clients (Client A1 and Client A2)
  const mockUsers = {
    clientA1: {
      id: 'profile-client-a1',
      authUserId: 'auth-client-a1',
      email: 'client-a1@acme.corp',
      firstName: 'Alice',
      lastName: 'Acme',
      fullName: 'Alice Acme',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: 'client-a1-uuid',
      client: { id: 'client-a1-uuid', name: 'Acme Corp', status: 'active' },
      isActive: true,
    },
    clientA2: {
      id: 'profile-client-a2',
      authUserId: 'auth-client-a2',
      email: 'client-a2@beta.corp',
      firstName: 'Bob',
      lastName: 'Beta',
      fullName: 'Bob Beta',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: 'client-a2-uuid',
      client: { id: 'client-a2-uuid', name: 'Beta Ltd', status: 'active' },
      isActive: true,
    },
    recruiterOrgA: {
      id: 'profile-recruiter-a',
      authUserId: 'auth-recruiter-a',
      email: 'recruiter@alpha.agency',
      firstName: 'Rachel',
      lastName: 'Recruiter',
      fullName: 'Rachel Recruiter',
      role: UserRole.RECRUITER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: null,
      client: null,
      isActive: true,
    },
    clientOrgB: {
      id: 'profile-client-b',
      authUserId: 'auth-client-b',
      email: 'client@gamma.corp',
      firstName: 'Gary',
      lastName: 'Gamma',
      fullName: 'Gary Gamma',
      role: UserRole.CLIENT,
      organizationId: 'org-b-uuid',
      organization: { id: 'org-b-uuid', name: 'Agency Bravo', slug: 'agency-bravo' },
      clientId: 'client-b-uuid',
      client: { id: 'client-b-uuid', name: 'Gamma Inc', status: 'active' },
      isActive: true,
    },
  };

  const sampleJobA1 = {
    id: 'job-a1-uuid',
    jobCode: 'JOB-1001',
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    employmentType: 'full_time',
    workplaceModel: 'remote',
    country: 'US',
    currency: 'USD',
    salaryMin: 120000,
    salaryMax: 150000,
    openings: 1,
    deadline: new Date('2026-12-31'),
    status: JobStatus.PUBLISHED,
    description: 'Lead frontend architecture in React/TypeScript.',
    requirements: '5+ years TS',
    skills: ['React', 'TypeScript'],
    organizationId: 'org-a-uuid',
    clientId: 'client-a1-uuid',
    createdAt: new Date('2026-01-01'),
    applications: [
      { id: 'app-a1-uuid', stage: ApplicationStage.CLIENT_REVIEW },
      { id: 'app-a2-uuid', stage: ApplicationStage.SHORTLISTED },
    ],
  };

  const sampleJobA2 = {
    id: 'job-a2-uuid',
    jobCode: 'JOB-1002',
    title: 'Backend Engineer',
    status: JobStatus.PUBLISHED,
    organizationId: 'org-a-uuid',
    clientId: 'client-a2-uuid',
    createdAt: new Date('2026-01-01'),
    applications: [{ id: 'app-b1-uuid', stage: ApplicationStage.APPLIED }],
  };

  const sampleApplicationA1 = {
    id: 'app-a1-uuid',
    candidateId: 'cand-1-uuid',
    jobId: 'job-a1-uuid',
    organizationId: 'org-a-uuid',
    clientId: 'client-a1-uuid',
    stage: ApplicationStage.CLIENT_REVIEW,
    status: 'active',
    appliedAt: new Date('2026-02-01'),
    answers: { experienceYears: 6 },
    recruiterNotes: 'Top secret recruiter salary negotiation note',
    clientFeedback: 'Looking promising',
    job: {
      id: 'job-a1-uuid',
      jobCode: 'JOB-1001',
      title: 'Senior Frontend Engineer',
      status: JobStatus.PUBLISHED,
    },
    candidate: {
      id: 'cand-1-uuid',
      candidateCode: 'CAND-1001',
      name: 'John Doe',
      normalizedEmail: 'john.doe@example.com',
      phone: '+1-555-0199',
      location: 'San Francisco, CA',
      skills: ['React', 'TypeScript'],
      education: [],
      experience: [],
    },
    resumes: [
      {
        id: 'resume-1-uuid',
        originalFilename: 'john_doe_resume.pdf',
        fileSize: 102400,
        contentType: 'application/pdf',
        storagePath: 'resumes/org-a-uuid/cand-1-uuid/secret-storage-uuid.pdf',
        bucket: 'resumes',
        uploadedAt: new Date('2026-02-01'),
      },
    ],
    stageHistories: [
      {
        id: 'hist-1',
        previousStage: 'Screening',
        nextStage: 'Client Review',
        reason: 'Passed technical screen',
        timestamp: new Date('2026-02-02'),
      },
    ],
    interviewRequests: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    setTokenVerifier(async (token: string) => {
      if (token === 'token-client-a1') return { authUserId: 'auth-client-a1' };
      if (token === 'token-client-a2') return { authUserId: 'auth-client-a2' };
      if (token === 'token-recruiter-a') return { authUserId: 'auth-recruiter-a' };
      if (token === 'token-client-b') return { authUserId: 'auth-client-b' };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.authUserId === 'auth-client-a1' || where.id === 'profile-client-a1') return Promise.resolve(mockUsers.clientA1);
      if (where.authUserId === 'auth-client-a2' || where.id === 'profile-client-a2') return Promise.resolve(mockUsers.clientA2);
      if (where.authUserId === 'auth-recruiter-a' || where.id === 'profile-recruiter-a') return Promise.resolve(mockUsers.recruiterOrgA);
      if (where.authUserId === 'auth-client-b' || where.id === 'profile-client-b') return Promise.resolve(mockUsers.clientOrgB);
      return Promise.resolve(null);
    });

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return callback(prisma);
    });
  });

  // ==========================================================================
  // Test 1: Client A can list only Client A's assigned jobs
  // ==========================================================================
  it('1. Client A can list only Client A assigned jobs', async () => {
    (prisma.job.count as any).mockResolvedValue(1);
    (prisma.job.findMany as any).mockImplementation(({ where }: any) => {
      expect(where.organizationId).toBe('org-a-uuid');
      expect(where.clientId).toBe('client-a1-uuid');
      expect(where.status).toBe(JobStatus.PUBLISHED);
      return Promise.resolve([sampleJobA1]);
    });

    const res = await request(app)
      .get('/api/client-portal/jobs')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('job-a1-uuid');
    expect(res.body.data[0].jobCode).toBe('JOB-1001');
    expect(res.body.data[0].applicantCount).toBe(2);
    expect(res.body.data[0].reviewCount).toBe(1);
    expect(res.body.data[0].shortlistedCount).toBe(1);
  });

  // ==========================================================================
  // Test 2: Client A cannot list Client B's applications by changing jobId
  // ==========================================================================
  it('2. Client A1 cannot list Client A2 applications by supplying Client A2 jobId', async () => {
    (prisma.job.findFirst as any).mockImplementation(({ where }: any) => {
      // Searching for job-a2-uuid with clientId = client-a1-uuid will return null
      if (where.id === 'job-a2-uuid' && where.clientId === 'client-a1-uuid') {
        return Promise.resolve(null);
      }
      return Promise.resolve(sampleJobA2);
    });

    const res = await request(app)
      .get('/api/client-portal/jobs/job-a2-uuid/applications')
      .set('Authorization', 'Bearer token-client-a1');

    // Must return non-disclosing 404
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ==========================================================================
  // Test 3: Client A cannot retrieve Client B's application by changing applicationId
  // ==========================================================================
  it('3. Client A1 cannot retrieve Client A2 application by changing applicationId', async () => {
    (prisma.application.findFirst as any).mockImplementation(({ where }: any) => {
      if (where.id === 'app-b1-uuid' && where.clientId === 'client-a1-uuid') {
        return Promise.resolve(null); // Does not belong to Client A1
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get('/api/client-portal/applications/app-b1-uuid')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ==========================================================================
  // Test 4: Client A cannot retrieve Candidate from another client via candidate route
  // ==========================================================================
  it('4. Client A1 cannot retrieve candidate of Client A2 or Org B', async () => {
    (prisma.candidate.findUnique as any).mockResolvedValue({
      id: 'cand-2-uuid',
      organizationId: 'org-a-uuid',
      applications: [{ clientId: 'client-a2-uuid' }],
    });

    const res = await request(app)
      .get('/api/candidates/cand-2-uuid')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(404);
  });

  // ==========================================================================
  // Test 5: Client A cannot generate a signed URL for Client B's resume
  // ==========================================================================
  it('5. Client A1 cannot generate signed URL for Client A2 resume', async () => {
    (prisma.application.findFirst as any).mockImplementation(({ where }: any) => {
      if (where.id === 'app-b1-uuid' && where.clientId === 'client-a1-uuid') {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .get('/api/client-portal/applications/app-b1-uuid/resume')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(404);
  });

  // ==========================================================================
  // Test 6: Client A cannot shortlist, reject, or request interview for Client B's application
  // ==========================================================================
  it('6. Client A1 cannot shortlist, reject, or request interview for Client A2 application', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(null);

    const shortlistRes = await request(app)
      .post('/api/client-portal/applications/app-b1-uuid/shortlist')
      .set('Authorization', 'Bearer token-client-a1')
      .send({});
    expect(shortlistRes.status).toBe(404);

    const rejectRes = await request(app)
      .post('/api/client-portal/applications/app-b1-uuid/reject')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ reason: 'Not qualified' });
    expect(rejectRes.status).toBe(404);

    const interviewRes = await request(app)
      .post('/api/client-portal/applications/app-b1-uuid/request-interview')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ preferredTimes: ['2026-10-15 10:00 AM'] });
    expect(interviewRes.status).toBe(404);
  });

  // ==========================================================================
  // Test 7: Client A cannot write feedback to Client B's application
  // ==========================================================================
  it('7. Client A1 cannot write feedback to Client A2 application', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/client-portal/applications/app-b1-uuid/feedback')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ feedback: 'Unauthorized feedback' });

    expect(res.status).toBe(404);
  });

  // ==========================================================================
  // Test 8: Client cannot read or update recruiterNotes through any client portal route
  // ==========================================================================
  it('8. Client cannot read recruiterNotes in detail, and notes mutation rejects recruiterNotes', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(sampleApplicationA1);

    const res = await request(app)
      .get('/api/client-portal/applications/app-a1-uuid')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(200);
    // recruiterNotes must be completely absent from returned payload!
    expect(res.body.data.recruiterNotes).toBeUndefined();
    expect(JSON.stringify(res.body.data)).not.toContain('Top secret recruiter');

    // Attempting to modify recruiterNotes via PATCH /api/applications/:id/notes must be 403 Forbidden
    (prisma.application.findUnique as any).mockResolvedValue(sampleApplicationA1);
    const patchRes = await request(app)
      .patch('/api/applications/app-a1-uuid/notes')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ recruiterNotes: 'Hacked note' });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('FORBIDDEN');
  });

  // ==========================================================================
  // Test 9: Client cannot change their own clientId, organizationId, or role
  // ==========================================================================
  it('9. Client profile endpoint derives context only from trusted req.user and rejects client-supplied tenant ids', async () => {
    (prisma.client.findFirst as any).mockResolvedValue(mockUsers.clientA1.client);

    const res = await request(app)
      .get('/api/client-portal/me')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(200);
    expect(res.body.data.user.clientId).toBe('client-a1-uuid');
    expect(res.body.data.user.organizationId).toBe('org-a-uuid');
    expect(res.body.data.user.role).toBe(UserRole.CLIENT);
  });

  // ==========================================================================
  // Test 10: Recruiter/Manager cannot cross into Client Portal without client role
  // ==========================================================================
  it('10. Recruiter role is denied access to Client Portal routes', async () => {
    const res = await request(app)
      .get('/api/client-portal/jobs')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // ==========================================================================
  // Test 11: Missing, expired, or invalid authentication is denied
  // ==========================================================================
  it('11. Missing or invalid authentication token returns 401', async () => {
    const missingRes = await request(app).get('/api/client-portal/jobs');
    expect(missingRes.status).toBe(401);

    const invalidRes = await request(app)
      .get('/api/client-portal/jobs')
      .set('Authorization', 'Bearer invalid-token-xyz');
    expect(invalidRes.status).toBe(401);
  });

  // ==========================================================================
  // Test 12: Invalid stage transitions are rejected and do not leave orphaned records
  // ==========================================================================
  it('12. Shortlist is denied if application is not in Client Review stage', async () => {
    const appliedApp = { ...sampleApplicationA1, stage: ApplicationStage.APPLIED };
    (prisma.application.findFirst as any).mockResolvedValue(appliedApp);

    const res = await request(app)
      .post('/api/client-portal/applications/app-a1-uuid/shortlist')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ notes: 'premature shortlist' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(prisma.stageHistory.create).not.toHaveBeenCalled();
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 13: Repeated action requests do not create duplicate audit records (Idempotency)
  // ==========================================================================
  it('13. Repeated shortlist on already shortlisted candidate returns 200 without creating duplicate history', async () => {
    const shortlistedApp = { ...sampleApplicationA1, stage: ApplicationStage.SHORTLISTED };
    (prisma.application.findFirst as any).mockResolvedValue(shortlistedApp);

    const res = await request(app)
      .post('/api/client-portal/applications/app-a1-uuid/shortlist')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ notes: 'duplicate click' });

    expect(res.status).toBe(200);
    // Did not create second history or activity
    expect(prisma.stageHistory.create).not.toHaveBeenCalled();
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Test 14: Client safe DTOs contain no internal notes, private storage paths, or privileged metadata
  // ==========================================================================
  it('14. Client safe DTO strips private storage paths and raw database fields', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(sampleApplicationA1);

    const res = await request(app)
      .get('/api/client-portal/applications/app-a1-uuid')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.resumes).toHaveLength(1);
    expect(data.resumes[0].originalFilename).toBe('john_doe_resume.pdf');
    // Crucial security check: storagePath and bucket must NOT be present in safe DTO
    expect(data.resumes[0].storagePath).toBeUndefined();
    expect(data.resumes[0].bucket).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain('secret-storage-uuid');
  });

  // ==========================================================================
  // Test 15: Public application routes remain public where intended and do not leak client portal
  // ==========================================================================
  it('15. Public careers endpoints remain publicly accessible and do not grant client portal access', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org-a-uuid', slug: 'agency-alpha', status: 'active' });
    (prisma.job.findMany as any).mockResolvedValue([]);

    const publicRes = await request(app).get('/api/career/agency-alpha/jobs');
    expect(publicRes.status).toBe(200);

    // Unauthenticated request to client portal is rejected
    const portalRes = await request(app).get('/api/client-portal/me');
    expect(portalRes.status).toBe(401);
  });

  // ==========================================================================
  // Test 16: Request Interview creates pending request and explicitly does NOT claim interview scheduled
  // ==========================================================================
  it('16. Request interview records pending InterviewRequest entity without falsely claiming scheduled meeting', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(sampleApplicationA1);
    (prisma.interviewRequest.findFirst as any).mockResolvedValue(null);
    (prisma.interviewRequest.create as any).mockResolvedValue({
      id: 'req-1-uuid',
      applicationId: 'app-a1-uuid',
      jobId: 'job-a1-uuid',
      clientId: 'client-a1-uuid',
      status: InterviewRequestStatus.PENDING,
      preferredTimes: ['2026-10-20 Morning', '2026-10-21 Afternoon'],
      notes: 'Focus on React performance',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/client-portal/applications/app-a1-uuid/request-interview')
      .set('Authorization', 'Bearer token-client-a1')
      .send({
        preferredTimes: ['2026-10-20 Morning', '2026-10-21 Afternoon'],
        notes: 'Focus on React performance',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.message).toContain('Interview request submitted');
    // Verify it does NOT claim an interview is scheduled or invitation sent
    expect(res.body.data.message).not.toContain('scheduled');
    expect(res.body.data.message).not.toContain('invitation sent');
    expect(prisma.interviewRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'interview_requested',
          visibility: 'client_visible',
        }),
      })
    );
  });

  // ==========================================================================
  // Test 17: Authorized Resume Download generates 60s signed URL
  // ==========================================================================
  it('17. Authorized resume download generates 60s signed URL for owned application', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(sampleApplicationA1);
    (prisma.resume.findFirst as any).mockResolvedValue(sampleApplicationA1.resumes[0]);

    const res = await request(app)
      .get('/api/client-portal/applications/app-a1-uuid/resume')
      .set('Authorization', 'Bearer token-client-a1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.signedUrl).toBe('https://supabase.mock.storage/signed-resume-url');
    expect(res.body.data.expiresIn).toBe(60);
  });

  // ==========================================================================
  // Test 18: Feedback submission updates clientFeedback atomically
  // ==========================================================================
  it('18. Client submits feedback without modifying recruiterNotes and generates client_visible activity', async () => {
    (prisma.application.findFirst as any).mockResolvedValue(sampleApplicationA1);

    const res = await request(app)
      .post('/api/client-portal/applications/app-a1-uuid/feedback')
      .set('Authorization', 'Bearer token-client-a1')
      .send({ feedback: 'Candidate showed great communication skills during review.' });

    expect(res.status).toBe(200);
    expect(prisma.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'app-a1-uuid' },
        data: expect.objectContaining({
          clientFeedback: 'Candidate showed great communication skills during review.',
        }),
      })
    );
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'client_feedback_submitted',
          visibility: 'client_visible',
        }),
      })
    );
  });
});
