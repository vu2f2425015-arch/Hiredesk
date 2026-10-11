import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier } from '../src/services/auth.js';
import { UserRole, ApplicationStage, JobStatus } from '@hiredesk/shared';

const CANDIDATE_ID = '11111111-1111-1111-1111-111111111111';
const FOLDER_ID = '22222222-2222-2222-2222-222222222222';
const JOB_ID_1 = '33333333-3333-3333-3333-333333333333';
const JOB_ID_2 = '44444444-4444-4444-4444-444444444444';
const JOB_ID_B = '55555555-5555-5555-5555-555555555555';

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
      create: vi.fn(),
      count: vi.fn(),
    },
    candidate: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    stageHistory: {
      create: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
    talentPoolFolder: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    talentPoolFolderMember: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  return {
    prisma: mockPrisma,
  };
});

import { prisma } from '@hiredesk/database';

describe('Phase 8A: Organization-Scoped Talent Pool, Folders & Candidate Association', () => {
  const app = createApp();

  const mockUsers = {
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
    managerOrgA: {
      id: 'profile-manager-a',
      authUserId: 'auth-manager-a',
      email: 'manager@alpha.agency',
      firstName: 'Mike',
      lastName: 'Manager',
      fullName: 'Mike Manager',
      role: UserRole.MANAGER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: null,
      client: null,
      isActive: true,
    },
    clientOrgA: {
      id: 'profile-client-a',
      authUserId: 'auth-client-a',
      email: 'client@client.corp',
      firstName: 'Charlie',
      lastName: 'Client',
      fullName: 'Charlie Client',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: 'client-1-uuid',
      client: { id: 'client-1-uuid', name: 'Acme Corp', status: 'active' },
      isActive: true,
    },
    recruiterOrgB: {
      id: 'profile-recruiter-b',
      authUserId: 'auth-recruiter-b',
      email: 'recruiter@bravo.agency',
      firstName: 'Bob',
      lastName: 'Bravo',
      fullName: 'Bob Bravo',
      role: UserRole.RECRUITER,
      organizationId: 'org-b-uuid',
      organization: { id: 'org-b-uuid', name: 'Agency Bravo', slug: 'agency-bravo' },
      clientId: null,
      client: null,
      isActive: true,
    },
  };

  const sampleCandidate = {
    id: CANDIDATE_ID,
    organizationId: 'org-a-uuid',
    candidateCode: 'CAND-1001',
    name: 'Sarah Connor',
    normalizedEmail: 'sarah.connor@example.com',
    phone: '+1-555-0101',
    location: 'Los Angeles, CA',
    country: 'United States',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    notes: 'Experienced full stack developer',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    updatedAt: new Date('2026-01-15T10:00:00Z'),
    applications: [
      {
        id: 'app-1-uuid',
        jobId: JOB_ID_1,
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        stage: ApplicationStage.SHORTLISTED,
        source: 'direct',
        appliedAt: new Date('2026-01-15T10:00:00Z'),
        recruiterNotes: 'Top candidate',
        clientFeedback: null,
        job: {
          id: JOB_ID_1,
          jobCode: 'JOB-1001',
          title: 'Senior Full Stack Engineer',
          status: JobStatus.PUBLISHED,
        },
        client: {
          id: 'client-1-uuid',
          name: 'Acme Corp',
        },
      },
    ],
    folderMemberships: [
      {
        id: 'fm-1-uuid',
        folderId: FOLDER_ID,
        candidateId: CANDIDATE_ID,
        folder: {
          id: FOLDER_ID,
          name: 'Frontend Leads',
        },
      },
    ],
    resumes: [
      { id: 'resume-1-uuid', uploadedAt: new Date('2026-01-15T10:00:00Z') },
    ],
  };

  const sampleFolder = {
    id: FOLDER_ID,
    organizationId: 'org-a-uuid',
    name: 'Frontend Leads',
    description: 'High-priority frontend engineers',
    createdAt: new Date('2026-01-10T10:00:00Z'),
    updatedAt: new Date('2026-01-10T10:00:00Z'),
    _count: { members: 1 },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    setTokenVerifier(async (token: string) => {
      if (token === 'token-recruiter-a') return { authUserId: 'auth-recruiter-a' };
      if (token === 'token-manager-a') return { authUserId: 'auth-manager-a' };
      if (token === 'token-client-a') return { authUserId: 'auth-client-a' };
      if (token === 'token-recruiter-b') return { authUserId: 'auth-recruiter-b' };
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.authUserId === 'auth-recruiter-a' || where.id === 'profile-recruiter-a') {
        return Promise.resolve(mockUsers.recruiterOrgA);
      }
      if (where.authUserId === 'auth-manager-a' || where.id === 'profile-manager-a') {
        return Promise.resolve(mockUsers.managerOrgA);
      }
      if (where.authUserId === 'auth-client-a' || where.id === 'profile-client-a') {
        return Promise.resolve(mockUsers.clientOrgA);
      }
      if (where.authUserId === 'auth-recruiter-b' || where.id === 'profile-recruiter-b') {
        return Promise.resolve(mockUsers.recruiterOrgB);
      }
      return Promise.resolve(null);
    });
  });

  // ==========================================================================
  // 1. Authorization & Role Scoping
  // ==========================================================================

  it('TP-01: Rejects unauthenticated requests with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/talent-pool/candidates');
    expect(res.status).toBe(401);
  });

  it('TP-02: Strictly blocks client users with 403 Forbidden', async () => {
    const resCandidates = await request(app)
      .get('/api/talent-pool/candidates')
      .set('Authorization', 'Bearer token-client-a');
    expect(resCandidates.status).toBe(403);
    expect(resCandidates.body.error.code).toBe('FORBIDDEN');

    const resFolders = await request(app)
      .get('/api/talent-pool/folders')
      .set('Authorization', 'Bearer token-client-a');
    expect(resFolders.status).toBe(403);
    expect(resFolders.body.error.code).toBe('FORBIDDEN');
  });

  // ==========================================================================
  // 2. Candidate Search & Filters
  // ==========================================================================

  it('TP-03: Lists candidates strictly scoped to recruiter organization', async () => {
    (prisma.candidate.count as any).mockResolvedValue(1);
    (prisma.candidate.findMany as any).mockResolvedValue([sampleCandidate]);

    const res = await request(app)
      .get('/api/talent-pool/candidates?page=1&limit=20')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.candidates).toHaveLength(1);
    expect(res.body.data.candidates[0].name).toBe('Sarah Connor');
    expect(res.body.data.candidates[0].candidateCode).toBe('CAND-1001');
    expect(res.body.data.candidates[0].totalApplications).toBe(1);
    expect(res.body.data.candidates[0].folders).toEqual([{ id: FOLDER_ID, name: 'Frontend Leads' }]);
    expect(res.body.data.pagination.total).toBe(1);

    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a-uuid',
        }),
      })
    );
  });

  it('TP-04: Filters candidates by search query, skills, and folder', async () => {
    (prisma.candidate.count as any).mockResolvedValue(1);
    (prisma.candidate.findMany as any).mockResolvedValue([sampleCandidate]);

    const res = await request(app)
      .get(`/api/talent-pool/candidates?search=sarah&skills=React,TypeScript&folderId=${FOLDER_ID}&stage=Shortlisted`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(prisma.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-a-uuid',
          OR: expect.any(Array),
          skills: { hasSome: ['React', 'TypeScript'] },
          folderMemberships: {
            some: {
              folderId: FOLDER_ID,
              folder: { organizationId: 'org-a-uuid' },
            },
          },
          applications: {
            some: expect.objectContaining({
              stage: 'Shortlisted',
              organizationId: 'org-a-uuid',
            }),
          },
        }),
      })
    );
  });

  it('TP-05: Rejects invalid query parameters with 400 Validation Error', async () => {
    const res = await request(app)
      .get('/api/talent-pool/candidates?page=invalid-num')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TP-06: Retrieves detailed candidate talent profile', async () => {
    (prisma.candidate.findFirst as any).mockResolvedValue({
      ...sampleCandidate,
      applications: [
        {
          ...sampleCandidate.applications[0],
          stageHistories: [
            {
              id: 'sh-1',
              previousStage: 'None',
              nextStage: 'Applied',
              timestamp: new Date('2026-01-15T10:00:00Z'),
              actor: {
                id: 'profile-recruiter-a',
                firstName: 'Rachel',
                lastName: 'Recruiter',
                email: 'recruiter@alpha.agency',
                role: 'recruiter',
              },
            },
          ],
        },
      ],
      resumes: [
        {
          id: 'res-1',
          originalFilename: 'resume.pdf',
          contentType: 'application/pdf',
          fileSize: 10240,
          parsingStatus: 'parsed',
          extractedText: 'Full stack engineer with 5 years experience',
          uploadedAt: new Date('2026-01-15T10:00:00Z'),
        },
      ],
    });

    const res = await request(app)
      .get(`/api/talent-pool/candidates/${CANDIDATE_ID}`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(CANDIDATE_ID);
    expect(res.body.data.candidateCode).toBe('CAND-1001');
    expect(res.body.data.applications).toHaveLength(1);
    expect(res.body.data.resumes).toHaveLength(1);
  });

  it('TP-07: Blocks cross-tenant candidate detail access with 404 Not Found', async () => {
    (prisma.candidate.findFirst as any).mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/talent-pool/candidates/${CANDIDATE_ID}`)
      .set('Authorization', 'Bearer token-recruiter-b');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(prisma.candidate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CANDIDATE_ID,
          organizationId: 'org-b-uuid',
        },
      })
    );
  });

  // ==========================================================================
  // 3. Multi-Job Association & Deduplication
  // ==========================================================================

  it('TP-08: Associates candidate with new job creating new Application in Applied stage', async () => {
    const targetJob = {
      id: JOB_ID_2,
      jobCode: 'JOB-1002',
      title: 'Backend Engineer',
      organizationId: 'org-a-uuid',
      clientId: 'client-1-uuid',
      status: JobStatus.PUBLISHED,
    };

    (prisma.candidate.findFirst as any).mockResolvedValue(sampleCandidate);
    (prisma.job.findFirst as any).mockResolvedValue(targetJob);
    (prisma.application.findUnique as any).mockResolvedValue(null); // No prior application

    const createdApp = {
      id: 'app-2-uuid',
      candidateId: CANDIDATE_ID,
      jobId: JOB_ID_2,
      organizationId: 'org-a-uuid',
      clientId: 'client-1-uuid',
      stage: ApplicationStage.APPLIED,
      source: 'talent_pool',
      job: { id: targetJob.id, jobCode: targetJob.jobCode, title: targetJob.title },
      client: { id: 'client-1-uuid', name: 'Acme Corp' },
    };

    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      const tx = {
        application: { create: vi.fn().mockResolvedValue(createdApp) },
        stageHistory: { create: vi.fn().mockResolvedValue({}) },
        activityLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return callback(tx);
    });

    const res = await request(app)
      .post(`/api/talent-pool/candidates/${CANDIDATE_ID}/applications`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({
        jobId: JOB_ID_2,
        source: 'talent_pool',
        recruiterNotes: 'Reassigned from talent pool based on backend skills',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isExisting).toBe(false);
    expect(res.body.data.application.id).toBe('app-2-uuid');
    expect(res.body.data.application.stage).toBe('Applied');
  });

  it('TP-09: Idempotently returns existing application if candidate is already assigned to job', async () => {
    const targetJob = {
      id: JOB_ID_1,
      jobCode: 'JOB-1001',
      title: 'Senior Full Stack Engineer',
      organizationId: 'org-a-uuid',
      clientId: 'client-1-uuid',
    };

    const existingApp = {
      id: 'app-1-uuid',
      jobId: JOB_ID_1,
      candidateId: CANDIDATE_ID,
      stage: ApplicationStage.SHORTLISTED,
      job: targetJob,
    };

    (prisma.candidate.findFirst as any).mockResolvedValue(sampleCandidate);
    (prisma.job.findFirst as any).mockResolvedValue(targetJob);
    (prisma.application.findUnique as any).mockResolvedValue(existingApp);

    const res = await request(app)
      .post(`/api/talent-pool/candidates/${CANDIDATE_ID}/applications`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ jobId: JOB_ID_1 });

    expect(res.status).toBe(200);
    expect(res.body.data.isExisting).toBe(true);
    expect(res.body.data.application.id).toBe('app-1-uuid');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('TP-10: Rejects association with job from another organization with 404', async () => {
    (prisma.candidate.findFirst as any).mockResolvedValue(sampleCandidate);
    (prisma.job.findFirst as any).mockResolvedValue(null); // Not found in Org A

    const res = await request(app)
      .post(`/api/talent-pool/candidates/${CANDIDATE_ID}/applications`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ jobId: JOB_ID_B });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  // ==========================================================================
  // 4. Folder Management (CRUD & Membership)
  // ==========================================================================

  it('TP-11: Lists folders for recruiter organization with candidate count', async () => {
    (prisma.talentPoolFolder.findMany as any).mockResolvedValue([sampleFolder]);

    const res = await request(app)
      .get('/api/talent-pool/folders')
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Frontend Leads');
    expect(res.body.data[0].candidateCount).toBe(1);
  });

  it('TP-12: Creates a new folder within the organization', async () => {
    (prisma.talentPoolFolder.findUnique as any).mockResolvedValue(null);
    (prisma.talentPoolFolder.create as any).mockResolvedValue({
      id: 'folder-2-uuid',
      organizationId: 'org-a-uuid',
      name: 'Python Wizards',
      description: 'Backend Python experts',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/talent-pool/folders')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ name: 'Python Wizards', description: 'Backend Python experts' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Python Wizards');
    expect(prisma.talentPoolFolder.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-a-uuid',
        name: 'Python Wizards',
        description: 'Backend Python experts',
      },
    });
  });

  it('TP-13: Prevents duplicate folder name in same organization with 409 Conflict', async () => {
    (prisma.talentPoolFolder.findUnique as any).mockResolvedValue(sampleFolder);

    const res = await request(app)
      .post('/api/talent-pool/folders')
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ name: 'Frontend Leads' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('FOLDER_EXISTS');
  });

  it('TP-14: Renames folder within organization boundary', async () => {
    (prisma.talentPoolFolder.findFirst as any).mockResolvedValue(sampleFolder);
    (prisma.talentPoolFolder.findUnique as any).mockResolvedValue(null);
    (prisma.talentPoolFolder.update as any).mockResolvedValue({
      ...sampleFolder,
      name: 'UI Architects',
    });

    const res = await request(app)
      .patch(`/api/talent-pool/folders/${FOLDER_ID}`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ name: 'UI Architects' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('UI Architects');
  });

  it('TP-15: Adds candidate to folder after verifying organization scope', async () => {
    (prisma.talentPoolFolder.findFirst as any).mockResolvedValue(sampleFolder);
    (prisma.candidate.findFirst as any).mockResolvedValue(sampleCandidate);
    (prisma.talentPoolFolderMember.upsert as any).mockResolvedValue({});

    const res = await request(app)
      .post(`/api/talent-pool/folders/${FOLDER_ID}/candidates`)
      .set('Authorization', 'Bearer token-recruiter-a')
      .send({ candidateId: CANDIDATE_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.talentPoolFolderMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          folderId_candidateId: {
            folderId: FOLDER_ID,
            candidateId: CANDIDATE_ID,
          },
        },
      })
    );
  });

  it('TP-16: Removes candidate from folder without deleting candidate or applications', async () => {
    (prisma.talentPoolFolder.findFirst as any).mockResolvedValue(sampleFolder);
    (prisma.talentPoolFolderMember.deleteMany as any).mockResolvedValue({ count: 1 });

    const res = await request(app)
      .delete(`/api/talent-pool/folders/${FOLDER_ID}/candidates/${CANDIDATE_ID}`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.talentPoolFolderMember.deleteMany).toHaveBeenCalledWith({
      where: {
        folderId: FOLDER_ID,
        candidateId: CANDIDATE_ID,
      },
    });
  });

  it('TP-17: Deletes folder without affecting candidate records', async () => {
    (prisma.talentPoolFolder.findFirst as any).mockResolvedValue(sampleFolder);
    (prisma.talentPoolFolder.delete as any).mockResolvedValue(sampleFolder);

    const res = await request(app)
      .delete(`/api/talent-pool/folders/${FOLDER_ID}`)
      .set('Authorization', 'Bearer token-recruiter-a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.talentPoolFolder.delete).toHaveBeenCalledWith({
      where: { id: FOLDER_ID },
    });
  });
});
