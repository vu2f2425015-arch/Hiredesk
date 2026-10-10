import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { setStorageAdapter, resetStorageAdapter, StorageAdapter } from '../src/services/storage.js';
import { UserRole, JobStatus } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  let candCounter = 1000;

  const mockPrisma = {
    $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    candidate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    application: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    resume: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    stageHistory: {
      create: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
    allocateNextJobCode: vi.fn().mockResolvedValue('JOB-1001'),
    allocateNextCandidateCode: vi.fn().mockImplementation(async () => {
      candCounter += 1;
      return `CAND-${candCounter}`;
    }),
    setJobCodeAllocator: vi.fn(),
    setCandidateCodeAllocator: vi.fn(),
  };
});

import { prisma, allocateNextCandidateCode } from '@hiredesk/database';

describe('Phase 3: Candidates, Applications, Resume Storage & Public Apply Flow', () => {
  const app = createApp();

  // Mock Storage Adapter
  const uploadedFiles: Map<string, Buffer> = new Map();
  const mockStorageAdapter: StorageAdapter = {
    uploadFile: vi.fn().mockImplementation(async (_bucket, path, buffer) => {
      uploadedFiles.set(path, buffer);
    }),
    deleteFile: vi.fn().mockImplementation(async (_bucket, path) => {
      uploadedFiles.delete(path);
    }),
    createSignedUrl: vi.fn().mockImplementation(async (_bucket, path, expiresIn) => {
      return `https://storage.supabase.co/signed/${path}?expires=${expiresIn}`;
    }),
  };

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
      isActive: true,
    },
    clientOrgA: {
      id: 'user-client-a',
      authUserId: 'auth-client-a',
      email: 'hiring@globex.local',
      firstName: 'George',
      lastName: 'Globex',
      fullName: 'George Globex',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency', slug: 'apex-agency' },
      clientId: 'client-globex-uuid',
      isActive: true,
    },
    clientOther: {
      id: 'user-client-other',
      authUserId: 'auth-client-other',
      email: 'hiring@initech.local',
      firstName: 'Ian',
      lastName: 'Initech',
      fullName: 'Ian Initech',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Apex Agency', slug: 'apex-agency' },
      clientId: 'client-initech-uuid',
      isActive: true,
    },
  };

  // Valid PDF header buffer (%PDF-1.4 ...)
  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
  // Valid DOCX header buffer (PK\x03\x04 ...)
  const validDocxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);

  beforeEach(() => {
    vi.clearAllMocks();
    uploadedFiles.clear();
    setStorageAdapter(mockStorageAdapter);

    setTokenVerifier(async (token: string) => {
      if (token === 'token-recruiter-a') return { authUserId: 'auth-recruiter-a', email: 'recruiter@apex.local' };
      if (token === 'token-recruiter-b') return { authUserId: 'auth-recruiter-b', email: 'recruiter@beta.local' };
      if (token === 'token-client-a') return { authUserId: 'auth-client-a', email: 'hiring@globex.local' };
      if (token === 'token-client-other') return { authUserId: 'auth-client-other', email: 'hiring@initech.local' };
      return null;
    });

    // Default mock user profile resolver
    vi.mocked(prisma.userProfile.findUnique).mockImplementation(async ({ where }: any) => {
      if (where.authUserId === 'auth-recruiter-a') return mockUsers.recruiterOrgA as any;
      if (where.authUserId === 'auth-recruiter-b') return mockUsers.recruiterOrgB as any;
      if (where.authUserId === 'auth-client-a') return mockUsers.clientOrgA as any;
      if (where.authUserId === 'auth-client-other') return mockUsers.clientOther as any;
      return null;
    });

    vi.mocked(prisma.candidate.update).mockImplementation(async ({ data }: any) => ({
      id: 'cand-1-uuid',
      candidateCode: 'CAND-1001',
      normalizedEmail: 'alice@example.com',
      name: 'Alice Wonder',
      phone: data.phone || '+1555123456',
    } as any));

    vi.mocked(prisma.application.create).mockImplementation(async ({ data }: any) => ({
      id: 'app-1-uuid',
      ...data,
    } as any));

    vi.mocked(prisma.resume.create).mockImplementation(async ({ data }: any) => ({
      id: 'resume-1-uuid',
      ...data,
    } as any));

    vi.mocked(prisma.stageHistory.create).mockImplementation(async ({ data }: any) => ({
      id: 'stage-history-1-uuid',
      ...data,
    } as any));
  });

  describe('1. Public Application Submission & Data Integrity', () => {
    it('successfully submits application to a published job with valid PDF resume', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        name: 'Apex Agency',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        organizationId: 'org-a-uuid',
        clientId: 'client-globex-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.candidate.create).mockResolvedValue({
        id: 'cand-1-uuid',
        candidateCode: 'CAND-1001',
        normalizedEmail: 'alice@example.com',
        name: 'Alice Wonder',
        phone: '+1555123456',
      } as any);

      vi.mocked(prisma.application.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.application.create).mockResolvedValue({
        id: 'app-1-uuid',
        jobId: 'job-101-uuid',
        candidateId: 'cand-1-uuid',
        organizationId: 'org-a-uuid',
        stage: 'Applied',
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'Alice@Example.COM ')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'Alice_Resume.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.applicationId).toBe('app-1-uuid');
      expect(res.body.data.candidateCode).toBe('CAND-1001');
      expect(res.body.data.status).toBe('received');

      // Verify email was conservatively normalized (trimmed & lowercased)
      expect(prisma.candidate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            normalizedEmail: 'alice@example.com',
            name: 'Alice Wonder',
          }),
        })
      );

      // Verify Application was created with stage 'Applied' and source 'career_page'
      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stage: 'Applied',
            source: 'career_page',
            jobId: 'job-101-uuid',
            organizationId: 'org-a-uuid',
          }),
        })
      );
    });

    it('accepts valid DOCX resume under 10 MB', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        organizationId: 'org-a-uuid',
        clientId: 'client-globex-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
        id: 'cand-1-uuid',
        candidateCode: 'CAND-1001',
      } as any);

      vi.mocked(prisma.application.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.application.create).mockResolvedValue({
        id: 'app-2-uuid',
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Bob Builder')
        .field('email', 'bob@builder.com')
        .attach('resume', validDocxBuffer, {
          filename: 'Bob_CV.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('reuses existing candidate in the same organization and does not create duplicate candidate', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-102-uuid',
        jobCode: 'JOB-1002',
        organizationId: 'org-a-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      const existingCandidate = {
        id: 'cand-existing-uuid',
        candidateCode: 'CAND-1001',
        normalizedEmail: 'alice@example.com',
        name: 'Alice Wonder',
        phone: null,
      };

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue(existingCandidate as any);
      vi.mocked(prisma.candidate.update).mockResolvedValue({
        ...existingCandidate,
        phone: '+1555999888',
      } as any);

      vi.mocked(prisma.application.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.application.create).mockResolvedValue({
        id: 'app-new-job-uuid',
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1002/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555999888')
        .attach('resume', validPdfBuffer, 'Alice_Resume_Updated.pdf');

      expect(res.status).toBe(201);
      expect(prisma.candidate.create).not.toHaveBeenCalled();
      expect(prisma.candidate.update).toHaveBeenCalled();
    });

    it('enforces idempotency on duplicate submission to same job without creating duplicate records', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        organizationId: 'org-a-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
        id: 'cand-1-uuid',
        candidateCode: 'CAND-1001',
      } as any);

      // Existing application found for this job and candidate
      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        id: 'app-1-uuid',
        jobId: 'job-101-uuid',
        candidateId: 'cand-1-uuid',
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'Alice_Resume.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data.isDuplicate).toBe(true);
      expect(res.body.data.applicationId).toBe('app-1-uuid');
      expect(prisma.application.create).not.toHaveBeenCalled();
      expect(mockStorageAdapter.uploadFile).not.toHaveBeenCalled();
    });

    it('same candidate applying to a different job in the same organization creates distinct application', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-200-uuid',
        jobCode: 'JOB-2000',
        organizationId: 'org-a-uuid',
        clientId: 'client-globex-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue({
        id: 'cand-1-uuid',
        candidateCode: 'CAND-1001',
      } as any);

      vi.mocked(prisma.application.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.application.create).mockResolvedValue({
        id: 'app-second-job-uuid',
        jobId: 'job-200-uuid',
        candidateId: 'cand-1-uuid',
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-2000/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'Alice_Resume.pdf');

      expect(res.status).toBe(201);
      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId: 'job-200-uuid',
            candidateId: 'cand-1-uuid',
          }),
        })
      );
    });
  });

  describe('2. Job Status & Boundary Validations', () => {
    it('rejects application to a DRAFT job with 400', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-draft-uuid',
        jobCode: 'JOB-DRAFT',
        organizationId: 'org-a-uuid',
        status: JobStatus.DRAFT,
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-DRAFT/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('JOB_NOT_PUBLISHED');
    });

    it('rejects application to a CLOSED job with 400', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-closed-uuid',
        jobCode: 'JOB-CLOSED',
        organizationId: 'org-a-uuid',
        status: JobStatus.CLOSED,
      } as any);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-CLOSED/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('JOB_NOT_PUBLISHED');
    });

    it('returns 404 for unknown Job Code without any fuzzy matching', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-999999/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('rejects submission if Job Code belongs to a different organization', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      // Job belongs to org-b, so searching within org-a returns null
      vi.mocked(prisma.job.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-FROM-B/applications')
        .field('name', 'Alice Wonder')
        .field('email', 'alice@example.com')
        .field('phone', '+1555123456')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(404);
    });

    it('rejects submission if honeypot spam trap field is populated', async () => {
      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Bot Spammer')
        .field('email', 'bot@spam.com')
        .field('phone', '+1555000000')
        .field('honeypot', 'http://spam-link.ru')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SPAM_DETECTED');
    });
  });

  describe('3. File Validation & Security', () => {
    it('rejects file larger than 10 MB', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024); // 10MB + 1KB
      // Set PDF header so it matches signature
      largeBuffer.write('%PDF-1.4');

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Large File Tester')
        .field('email', 'large@example.com')
        .field('phone', '+1555111222')
        .attach('resume', largeBuffer, 'huge_resume.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('10 MB');
    });

    it('rejects unsupported file extension (.exe)', async () => {
      const exeBuffer = Buffer.from('MZ\x90\x00');

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Malware Tester')
        .field('email', 'malware@example.com')
        .field('phone', '+1555111222')
        .attach('resume', exeBuffer, 'resume.exe');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Only PDF, DOCX, and DOC are accepted');
    });

    it('rejects file signature spoofing (plain text disguised as .pdf)', async () => {
      const fakePdfBuffer = Buffer.from('This is actually a plain text file, not a PDF');

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Spoof Tester')
        .field('email', 'spoof@example.com')
        .field('phone', '+1555111222')
        .attach('resume', fakePdfBuffer, 'fake.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('file signature mismatch');
    });

    it('cleans up uploaded storage file if database transaction fails', async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue({
        id: 'org-a-uuid',
        slug: 'apex-agency',
        status: 'active',
      } as any);

      vi.mocked(prisma.job.findFirst).mockResolvedValue({
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        organizationId: 'org-a-uuid',
        status: JobStatus.PUBLISHED,
      } as any);

      vi.mocked(prisma.candidate.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.candidate.create).mockResolvedValue({
        id: 'cand-cleanup-uuid',
        candidateCode: 'CAND-1005',
      } as any);

      vi.mocked(prisma.application.findUnique).mockResolvedValue(null);
      // Simulate database failure during application creation
      vi.mocked(prisma.application.create).mockRejectedValue(new Error('DB Connection Dropped'));

      const res = await request(app)
        .post('/api/career/apex-agency/jobs/JOB-1001/applications')
        .field('name', 'Failover Tester')
        .field('email', 'failover@example.com')
        .field('phone', '+1555111222')
        .attach('resume', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(500);
      // Storage upload was called, then deleteFile was invoked to clean up orphaned storage
      expect(mockStorageAdapter.uploadFile).toHaveBeenCalled();
      expect(mockStorageAdapter.deleteFile).toHaveBeenCalled();
    });
  });

  describe('4. Recruiter & Client Authorized Access Controls', () => {
    it('allows recruiter to list applications for jobs in their own organization', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        id: 'job-101-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-globex-uuid',
      } as any);

      vi.mocked(prisma.application.count).mockResolvedValue(1);
      vi.mocked(prisma.application.findMany).mockResolvedValue([
        {
          id: 'app-1-uuid',
          candidateId: 'cand-1-uuid',
          jobId: 'job-101-uuid',
          organizationId: 'org-a-uuid',
          clientId: 'client-globex-uuid',
          stage: 'Applied',
          source: 'career_page',
          appliedAt: new Date(),
          status: 'active',
          answers: {},
          candidate: {
            id: 'cand-1-uuid',
            candidateCode: 'CAND-1001',
            name: 'Alice Wonder',
            normalizedEmail: 'alice@example.com',
            phone: '+1555123456',
            location: 'New York',
          },
          resumes: [
            {
              id: 'resume-1-uuid',
              originalFilename: 'Alice_Resume.pdf',
              fileSize: 102400,
              contentType: 'application/pdf',
              uploadedAt: new Date(),
            },
          ],
        },
      ] as any);

      const res = await request(app)
        .get('/api/jobs/job-101-uuid/applications')
        .set('Authorization', 'Bearer token-recruiter-a');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].candidate.name).toBe('Alice Wonder');
    });

    it('denies recruiter from accessing applications for a job in another organization (404 non-disclosing)', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        id: 'job-org-b-uuid',
        organizationId: 'org-b-uuid',
        clientId: 'client-other-uuid',
      } as any);

      const res = await request(app)
        .get('/api/jobs/job-org-b-uuid/applications')
        .set('Authorization', 'Bearer token-recruiter-a'); // Recruiter A belongs to org-a

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('denies client user from accessing applications of another client company (404 non-disclosing)', async () => {
      vi.mocked(prisma.job.findUnique).mockResolvedValue({
        id: 'job-initech-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-initech-uuid', // belongs to Initech
      } as any);

      const res = await request(app)
        .get('/api/jobs/job-initech-uuid/applications')
        .set('Authorization', 'Bearer token-client-a'); // Client A is assigned to Globex

      expect(res.status).toBe(404);
    });

    it('generates 60-second signed resume URL for authorized recruiter', async () => {
      vi.mocked(prisma.application.findUnique).mockResolvedValue({
        id: 'app-1-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-globex-uuid',
      } as any);

      vi.mocked(prisma.resume.findFirst).mockResolvedValue({
        id: 'resume-1-uuid',
        applicationId: 'app-1-uuid',
        storagePath: 'org-a-uuid/cand-1-uuid/file.pdf',
        originalFilename: 'Alice_Resume.pdf',
      } as any);

      const res = await request(app)
        .get('/api/applications/app-1-uuid/resume')
        .set('Authorization', 'Bearer token-recruiter-a');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.signedUrl).toContain('https://storage.supabase.co/signed/');
      expect(res.body.data.expiresIn).toBe(60);
      expect(res.body.data.filename).toBe('Alice_Resume.pdf');
    });

    it('rejects unauthenticated user from requesting signed resume URL (401)', async () => {
      const res = await request(app).get('/api/applications/app-1-uuid/resume');
      expect(res.status).toBe(401);
    });
  });
});
