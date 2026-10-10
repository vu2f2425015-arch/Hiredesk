import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import { UserRole, EmploymentType, WorkplaceModel, JobStatus } from '@hiredesk/shared';

// Mock the @hiredesk/database module
vi.mock('@hiredesk/database', () => {
  let sequenceCounter = 1000;

  const mockPrisma = {
    $queryRaw: vi.fn().mockImplementation(async () => {
      sequenceCounter += 1;
      return [{ code: `JOB-${sequenceCounter}` }];
    }),
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
    allocateNextJobCode: vi.fn().mockImplementation(async () => {
      sequenceCounter += 1;
      return `JOB-${sequenceCounter}`;
    }),
    setJobCodeAllocator: vi.fn(),
  };
});

import { prisma, allocateNextJobCode } from '@hiredesk/database';

describe('Phase 2: Jobs, Atomic Global Job Codes, and Public Views', () => {
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

  const sampleJobOrgA = {
    id: 'job-1-uuid',
    organizationId: 'org-a-uuid',
    clientId: 'client-1-uuid',
    jobCode: 'JOB-1001',
    title: 'Senior Backend Engineer',
    department: 'Engineering',
    employmentType: 'full_time',
    workplaceModel: 'remote',
    country: 'United States',
    currency: 'USD',
    salaryMin: 120000,
    salaryMax: 150000,
    experienceYears: 4,
    openings: 2,
    deadline: new Date('2026-12-31'),
    education: "Bachelor's Degree",
    skills: ['Node.js', 'PostgreSQL', 'TypeScript'],
    description: 'We are seeking an experienced Backend Engineer to lead API design.',
    requirements: 'Strong SQL and distributed systems knowledge.',
    status: JobStatus.PUBLISHED,
    applicationFormConfig: {},
    createdBy: 'user-recruiter-a',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    client: { id: 'client-1-uuid', name: 'Acme Corp' },
    _count: { applications: 3 },
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

  // 1. Authenticated manager/recruiter can create a valid job
  it('1. Authenticated recruiter can create a valid job and receives server-generated jobCode', async () => {
    (prisma.client.findFirst as any).mockResolvedValueOnce({
      id: 'client-1-uuid',
      organizationId: 'org-a-uuid',
      name: 'Acme Corp',
    });

    (prisma.job.create as any).mockImplementationOnce(({ data }: any) => {
      return Promise.resolve({
        id: 'new-job-uuid',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { id: 'client-1-uuid', name: 'Acme Corp' },
        _count: { applications: 0 },
      });
    });

    const payload = {
      clientId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Fullstack Engineer',
      employmentType: EmploymentType.FULL_TIME,
      workplaceModel: WorkplaceModel.REMOTE,
      country: 'United States',
      description: 'Join our fast-growing engineering team building fullstack applications.',
      skills: ['TypeScript', 'React', 'Node.js'],
    };

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Fullstack Engineer');
    expect(res.body.data.jobCode).toMatch(/^JOB-\d+$/);
    expect(res.body.data.applicantCount).toBe(0);
  });

  // 2. Unauthenticated job creation is rejected with 401
  it('2. Unauthenticated job creation is rejected with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/jobs').send({ title: 'Unauthorized Job' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // 3. Client user cannot create or mutate a job
  it('3. Client user cannot create or mutate a job (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer token-client-1')
      .send({
        clientId: 'client-1-uuid',
        title: 'Forbidden Client Job',
        employmentType: EmploymentType.FULL_TIME,
        workplaceModel: WorkplaceModel.REMOTE,
        country: 'US',
        description: 'Client should not be able to create vacancies.',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // 4. Recruiter from Organization A cannot read/update/close a job belonging to Organization B
  it("4. Recruiter from Org A cannot read a job belonging to Org B (404 Non-disclosing)", async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce({
      ...sampleJobOrgA,
      organizationId: 'org-b-uuid', // belongs to Org B
    });

    const res = await request(app)
      .get('/api/jobs/job-belonging-to-org-b')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 5. A user cannot attach a job to a client in another organization
  it('5. Recruiter cannot attach a job to a client belonging to a different organization', async () => {
    (prisma.client.findFirst as any).mockResolvedValueOnce(null); // Client not found in Org A

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Invalid Client Job',
        employmentType: EmploymentType.FULL_TIME,
        workplaceModel: WorkplaceModel.REMOTE,
        country: 'US',
        description: 'Job referencing an unauthorized client company.',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CLIENT');
  });

  // 6. A malformed or invalid job payload is rejected with a validation error
  it('6. Malformed payload with min salary > max salary is rejected with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Invalid Salary Job',
        employmentType: EmploymentType.FULL_TIME,
        workplaceModel: WorkplaceModel.REMOTE,
        country: 'US',
        salaryMin: 150000,
        salaryMax: 90000, // Invalid: min > max
        description: 'Valid description that has enough characters for validation.',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 7. Job Code is generated by the trusted server/database, not accepted from client input
  it('7. Client-supplied jobCode in request body is ignored in favor of atomic server generation', async () => {
    (prisma.client.findFirst as any).mockResolvedValueOnce({
      id: 'client-1-uuid',
      organizationId: 'org-a-uuid',
    });

    (prisma.job.create as any).mockImplementationOnce(({ data }: any) => {
      return Promise.resolve({
        id: 'job-ignore-code-uuid',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { applications: 0 },
      });
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Tamper Code Job',
        jobCode: 'FORGED-9999', // Client attempts to force custom code
        employmentType: EmploymentType.FULL_TIME,
        workplaceModel: WorkplaceModel.REMOTE,
        country: 'US',
        description: 'Attempting to inject a custom client-controlled jobCode.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.jobCode).not.toBe('FORGED-9999');
    expect(res.body.data.jobCode).toMatch(/^JOB-\d+$/);
  });

  // 8. Multiple concurrent job creations produce distinct globally unique Job Codes
  it('8. Multiple concurrent job creations produce distinct globally unique Job Codes', async () => {
    (prisma.client.findFirst as any).mockResolvedValue({
      id: 'client-1-uuid',
      organizationId: 'org-a-uuid',
    });

    (prisma.job.create as any).mockImplementation(({ data }: any) => {
      return Promise.resolve({
        id: `job-${data.jobCode}`,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { applications: 0 },
      });
    });

    const makeRequest = () =>
      request(app)
        .post('/api/jobs')
        .set('Authorization', 'Bearer token-recruiter-a')
        .send({
          clientId: '123e4567-e89b-12d3-a456-426614174000',
          title: 'Concurrent Position',
          employmentType: EmploymentType.FULL_TIME,
          workplaceModel: WorkplaceModel.REMOTE,
          country: 'US',
          description: 'Testing concurrent race-free sequence code generation.',
        });

    const results = await Promise.all([makeRequest(), makeRequest(), makeRequest(), makeRequest()]);

    const codes = results.map((r) => r.body.data.jobCode);
    const uniqueCodes = new Set(codes);

    expect(uniqueCodes.size).toBe(4);
    codes.forEach((code) => expect(code).toMatch(/^JOB-\d+$/));
  });

  // 9. Job Code is immutable after creation
  it('9. PATCH /api/jobs/:id ignores any client attempt to alter jobCode or organizationId', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJobOrgA);

    (prisma.job.update as any).mockImplementationOnce(({ data }: any) => {
      expect(data.jobCode).toBeUndefined(); // Verification that jobCode was never passed to update
      expect(data.organizationId).toBeUndefined();
      return Promise.resolve({
        ...sampleJobOrgA,
        ...data,
      });
    });

    const res = await request(app)
      .patch(`/api/jobs/${sampleJobOrgA.id}`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        jobCode: 'TAMPERED-CODE',
        organizationId: 'hacked-org-uuid',
        title: 'Updated Senior Backend Engineer',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.jobCode).toBe('JOB-1001'); // Code remains pristine
    expect(res.body.data.title).toBe('Updated Senior Backend Engineer');
  });

  // 10. Duplicating a job generates a new code
  it('10. POST /api/jobs/:id/duplicate allocates a distinct atomic Job Code and starts in draft', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJobOrgA);

    (prisma.job.create as any).mockImplementationOnce(({ data }: any) => {
      return Promise.resolve({
        id: 'duplicated-job-uuid',
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: { id: 'client-1-uuid', name: 'Acme Corp' },
        _count: { applications: 0 },
      });
    });

    const res = await request(app)
      .post(`/api/jobs/${sampleJobOrgA.id}/duplicate`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(201);
    expect(res.body.data.jobCode).not.toBe(sampleJobOrgA.jobCode);
    expect(res.body.data.jobCode).toMatch(/^JOB-\d+$/);
    expect(res.body.data.status).toBe(JobStatus.DRAFT);
    expect(res.body.data.title).toBe(`${sampleJobOrgA.title} (Copy)`);
  });

  // 11. Public career listing returns published jobs only
  it('11. GET /api/career/:orgSlug/jobs returns ONLY published jobs and strips client IDs', async () => {
    (prisma.organization.findUnique as any).mockResolvedValueOnce({
      id: 'org-a-uuid',
      name: 'Apex Agency',
      slug: 'apex-agency',
    });

    (prisma.job.findMany as any).mockResolvedValueOnce([sampleJobOrgA]);

    const res = await request(app).get('/api/career/apex-agency/jobs');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobs).toHaveLength(1);
    expect(res.body.data.jobs[0].jobCode).toBe('JOB-1001');
    expect(res.body.data.jobs[0].organizationSlug).toBe('apex-agency');
    expect(res.body.data.jobs[0].clientId).toBeUndefined(); // Client ID is stripped
    expect(res.body.data.jobs[0].createdBy).toBeUndefined(); // Recruiter ID is stripped
  });

  // 12. Public job detail does not expose private/internal fields or unpublished jobs
  it('12. GET /api/career/:orgSlug/jobs/:jobCode returns 404 for unpublished or nonexistent jobs', async () => {
    (prisma.organization.findUnique as any).mockResolvedValueOnce({
      id: 'org-a-uuid',
      name: 'Apex Agency',
      slug: 'apex-agency',
    });

    (prisma.job.findFirst as any).mockResolvedValueOnce(null); // No published job found

    const res = await request(app).get('/api/career/apex-agency/jobs/JOB-9999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 13. Close/reopen transitions are validated and persisted
  it('13. POST /api/jobs/:id/close transitions published job to closed', async () => {
    (prisma.job.findUnique as any).mockResolvedValueOnce(sampleJobOrgA);

    (prisma.job.update as any).mockImplementationOnce(({ data }: any) => {
      return Promise.resolve({
        ...sampleJobOrgA,
        status: data.status,
      });
    });

    const res = await request(app)
      .post(`/api/jobs/${sampleJobOrgA.id}/close`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(JobStatus.CLOSED);
  });
});
