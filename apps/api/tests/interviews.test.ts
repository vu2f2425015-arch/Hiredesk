import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setTokenVerifier, resetTokenVerifier } from '../src/services/auth.js';
import {
  UserRole,
  InterviewStatus,
  InterviewType,
  InterviewRequestStatus,
  CommunicationStatus,
} from '@hiredesk/shared';

// Mock database client
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    $transaction: vi.fn(),
    userProfile: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
    },
    job: {
      findFirst: vi.fn(),
    },
    application: {
      findFirst: vi.fn(),
    },
    candidate: {
      findFirst: vi.fn(),
    },
    interview: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    interviewRequest: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    interviewHistory: {
      create: vi.fn(),
    },
    outboundCommunication: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@hiredesk/database';

describe('Phase 7: Interview Scheduling, Access Control, Calendar Events & Conflict Prevention', () => {
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
      isActive: true,
    },
    interviewerOrgA: {
      id: 'profile-interviewer-a',
      authUserId: 'auth-interviewer-a',
      email: 'interviewer@alpha.agency',
      firstName: 'Ian',
      lastName: 'Interviewer',
      fullName: 'Ian Interviewer',
      role: UserRole.RECRUITER,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: null,
      isActive: true,
    },
    clientA1: {
      id: 'profile-client-a1',
      authUserId: 'auth-client-a1',
      email: 'client@client1.com',
      firstName: 'Charlie',
      lastName: 'Client',
      fullName: 'Charlie Client',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: 'client-1-uuid',
      client: { id: 'client-1-uuid', name: 'Client 1 Corp', status: 'active' },
      isActive: true,
    },
    clientA2: {
      id: 'profile-client-a2',
      authUserId: 'auth-client-a2',
      email: 'client2@client2.com',
      firstName: 'David',
      lastName: 'Different',
      fullName: 'David Different',
      role: UserRole.CLIENT,
      organizationId: 'org-a-uuid',
      organization: { id: 'org-a-uuid', name: 'Agency Alpha', slug: 'agency-alpha' },
      clientId: 'client-2-uuid',
      client: { id: 'client-2-uuid', name: 'Client 2 Corp', status: 'active' },
      isActive: true,
    },
    recruiterOrgB: {
      id: 'profile-recruiter-b',
      authUserId: 'auth-recruiter-b',
      email: 'recruiter@beta.agency',
      firstName: 'Bob',
      lastName: 'Beta',
      fullName: 'Bob Beta',
      role: UserRole.RECRUITER,
      organizationId: 'org-b-uuid',
      organization: { id: 'org-b-uuid', name: 'Agency Beta', slug: 'agency-beta' },
      clientId: null,
      isActive: true,
    },
  };

  const sampleApplication = {
    id: 'app-1-uuid',
    organizationId: 'org-a-uuid',
    clientId: 'client-1-uuid',
    jobId: 'job-1-uuid',
    candidateId: 'cand-1-uuid',
    stage: 'Shortlisted',
    candidate: {
      id: 'cand-1-uuid',
      name: 'Alice Candidate',
      normalizedEmail: 'alice@example.com',
      candidateCode: 'CAND-1001',
    },
    job: {
      id: 'job-1-uuid',
      jobCode: 'JOB-1001',
      title: 'Fullstack Engineer',
    },
    client: {
      id: 'client-1-uuid',
      name: 'Client 1 Corp',
      contactEmail: 'contact@client1.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setTokenVerifier(async (token: string) => {
      const user = Object.values(mockUsers).find((u) => u.authUserId === token);
      if (user) {
        return { authUserId: user.authUserId, email: user.email };
      }
      return null;
    });

    (prisma.userProfile.findUnique as any).mockImplementation(({ where }: any) => {
      const user = Object.values(mockUsers).find(
        (u) => (where.authUserId && u.authUserId === where.authUserId) || (where.id && u.id === where.id)
      );
      return Promise.resolve(user || null);
    });

    (prisma.userProfile.findFirst as any).mockImplementation(({ where }: any) => {
      const user = Object.values(mockUsers).find(
        (u) => (!where.id || u.id === where.id) && (!where.organizationId || u.organizationId === where.organizationId)
      );
      return Promise.resolve(user || null);
    });

    (prisma.$transaction as any).mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(prisma);
      }
      return Promise.all(cb);
    });

    (prisma.activityLog.create as any).mockResolvedValue({ id: 'act-uuid' });
    (prisma.interviewHistory.create as any).mockResolvedValue({ id: 'hist-uuid' });
    (prisma.outboundCommunication.create as any).mockResolvedValue({ id: 'comm-uuid' });
  });


  describe('1. Recruiter Interview Scheduling (POST /api/interviews)', () => {
    it('successfully schedules a new interview with relations, history, activity log, and outbox', async () => {
      (prisma.application.findFirst as any).mockResolvedValue(sampleApplication);
      (prisma.userProfile.findFirst as any).mockResolvedValue(mockUsers.interviewerOrgA);
      (prisma.interview.findFirst as any).mockResolvedValueOnce(null); // No conflict

      const newInterviewRecord = {
        id: 'interview-created-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        applicationId: 'app-1-uuid',
        candidateId: 'cand-1-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        scheduledByUserProfileId: mockUsers.recruiterOrgA.id,
        type: InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'Asia/Kolkata',
        meetingUrl: 'https://meet.google.com/xyz',
        sequence: 0,
        interviewerNotes: 'Internal salary expectations discussed',
        candidate: sampleApplication.candidate,
        job: sampleApplication.job,
        client: sampleApplication.client,
        interviewer: mockUsers.interviewerOrgA,
        scheduledBy: mockUsers.recruiterOrgA,
        communications: [],
        histories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          interview: {
            create: vi.fn().mockResolvedValue(newInterviewRecord),
          },
          interviewHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-1' }),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({ id: 'act-1' }),
          },
          outboundCommunication: {
            create: vi.fn().mockResolvedValue({ id: 'comm-1' }),
          },
        };
        return cb(tx);
      });

      // Second findFirst call is getInterview at the end
      (prisma.interview.findFirst as any).mockResolvedValueOnce(newInterviewRecord);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          type: 'video',
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'Asia/Kolkata',
          meetingUrl: 'https://meet.google.com/xyz',
          interviewerNotes: 'Internal salary expectations discussed',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('interview-created-uuid');
      expect(res.body.data.status).toBe(InterviewStatus.SCHEDULED);
      expect(res.body.data.interviewerNotes).toBe('Internal salary expectations discussed');
    });

    it('rejects schedule request when endAt <= startAt with 400', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T11:00:00Z',
          endAt: '2026-10-20T10:00:00Z', // Before start
          timeZone: 'UTC',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects schedule request when duration is under 10 minutes with 400', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T10:05:00Z', // Only 5 minutes
          timeZone: 'UTC',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects schedule request when timezone is not a valid IANA identifier with 400', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'Invalid/NonExistent_Zone',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('detects and rejects overlapping interview for the same interviewer with 409 Conflict', async () => {
      (prisma.application.findFirst as any).mockResolvedValue(sampleApplication);
      (prisma.userProfile.findFirst as any).mockResolvedValue(mockUsers.interviewerOrgA);

      // Existing overlapping interview found
      (prisma.interview.findFirst as any).mockResolvedValueOnce({
        id: 'existing-overlap-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        startAt: new Date('2026-10-20T10:30:00Z'),
        endAt: new Date('2026-10-20T11:30:00Z'),
        status: InterviewStatus.SCHEDULED,
      });

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'UTC',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERVIEWER_CONFLICT');
      expect(res.body.error.message).toContain('already has an active interview');
    });

    it('links pending InterviewRequest and updates its status to scheduled', async () => {
      (prisma.application.findFirst as any).mockResolvedValue(sampleApplication);
      (prisma.userProfile.findFirst as any).mockResolvedValue(mockUsers.interviewerOrgA);
      (prisma.interview.findFirst as any).mockResolvedValueOnce(null); // No conflict

      const pendingReq = {
        id: 'req-pending-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        applicationId: 'app-1-uuid',
        status: InterviewRequestStatus.PENDING,
      };

      (prisma.interviewRequest.findFirst as any).mockResolvedValue(pendingReq);

      let updatedReqData: any = null;
      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          interview: {
            create: vi.fn().mockResolvedValue({ id: 'int-from-req-uuid' }),
          },
          interviewHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-1' }),
          },
          interviewRequest: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              updatedReqData = data;
              return Promise.resolve({ ...pendingReq, ...data });
            }),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({ id: 'act-1' }),
          },
          outboundCommunication: {
            create: vi.fn().mockResolvedValue({ id: 'comm-1' }),
          },
        };
        return cb(tx);
      });

      (prisma.interview.findFirst as any).mockResolvedValueOnce({
        id: 'int-from-req-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        applicationId: 'app-1-uuid',
        candidateId: 'cand-1-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        type: InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'UTC',
        sequence: 0,
        candidate: sampleApplication.candidate,
        job: sampleApplication.job,
        client: sampleApplication.client,
        interviewer: mockUsers.interviewerOrgA,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          interviewRequestId: 'req-pending-uuid',
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'UTC',
        });

      expect(res.status).toBe(201);
      expect(updatedReqData).toEqual({
        status: InterviewRequestStatus.SCHEDULED,
        interviewId: 'int-from-req-uuid',
      });
    });
  });

  describe('2. Multi-Tenant & Client Access Controls (Security)', () => {
    it('blocks client role from accessing recruiter schedule endpoint with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-client-a1')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'UTC',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('blocks recruiter of Agency B from scheduling for Agency A with 404 (non-disclosing)', async () => {
      // Agency B recruiter tries to schedule for Agency A application
      (prisma.application.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/interviews')
        .set('Authorization', 'Bearer auth-recruiter-b')
        .send({
          applicationId: 'app-1-uuid',
          jobId: 'job-1-uuid',
          candidateId: 'cand-1-uuid',
          clientId: 'client-1-uuid',
          interviewerUserProfileId: mockUsers.interviewerOrgA.id,
          startAt: '2026-10-20T10:00:00Z',
          endAt: '2026-10-20T11:00:00Z',
          timeZone: 'UTC',
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('client portal GET /api/client-portal/interviews/:id strictly redacts recruiter internal notes', async () => {
      (prisma.client.findFirst as any).mockResolvedValue(mockUsers.clientA1.client);

      (prisma.interview.findFirst as any).mockResolvedValue({
        id: 'interview-client-view-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        candidateId: 'cand-1-uuid',
        applicationId: 'app-1-uuid',
        status: InterviewStatus.SCHEDULED,
        type: InterviewType.VIDEO,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'UTC',
        meetingUrl: 'https://meet.google.com/xyz',
        interviewerNotes: 'CONFIDENTIAL: Candidate wants $150k min',
        candidate: { id: 'cand-1-uuid', name: 'Alice Candidate', candidateCode: 'CAND-1001' },
        job: { id: 'job-1-uuid', jobCode: 'JOB-1001', title: 'Fullstack Engineer' },
        interviewer: { id: 'interviewer-1', fullName: 'Ian Interviewer' },
        createdAt: new Date(),
      });

      const res = await request(app)
        .get('/api/client-portal/interviews/interview-client-view-uuid')
        .set('Authorization', 'Bearer auth-client-a1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Ensure internal notes are completely redacted
      expect(res.body.data.interviewerNotes).toBeUndefined();
      expect(JSON.stringify(res.body.data)).not.toContain('CONFIDENTIAL');
      expect(res.body.data.candidate.name).toBe('Alice Candidate');
    });

    it('client portal returns non-disclosing 404 when Client 2 requests an interview of Client 1', async () => {
      (prisma.client.findFirst as any).mockResolvedValue(mockUsers.clientA2.client);

      // Database findFirst returns null because clientId mismatch
      (prisma.interview.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/client-portal/interviews/interview-of-client-1')
        .set('Authorization', 'Bearer auth-client-a2');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Reschedule & Cancel Workflows', () => {
    it('rescheduling updates times, increments sequence, and records history', async () => {
      const existingInterview = {
        id: 'interview-reschedule-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        applicationId: 'app-1-uuid',
        candidateId: 'cand-1-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        type: InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'UTC',
        sequence: 0,
        candidate: sampleApplication.candidate,
        job: sampleApplication.job,
        client: sampleApplication.client,
        interviewer: mockUsers.interviewerOrgA,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.interview.findFirst as any).mockResolvedValueOnce(existingInterview); // find by id
      (prisma.interview.findFirst as any).mockResolvedValueOnce(null); // conflict check returns null

      let updatedData: any = null;
      let historyCreated: any = null;

      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          interview: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              updatedData = data;
              return Promise.resolve({ ...existingInterview, ...data });
            }),
          },
          interviewHistory: {
            create: vi.fn().mockImplementation(({ data }: any) => {
              historyCreated = data;
              return Promise.resolve({ id: 'hist-2', ...data });
            }),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({ id: 'act-2' }),
          },
          outboundCommunication: {
            create: vi.fn().mockResolvedValue({ id: 'comm-reschedule' }),
          },
        };
        return cb(tx);
      });

      // getInterview return
      (prisma.interview.findFirst as any).mockResolvedValueOnce({
        ...existingInterview,
        startAt: new Date('2026-10-21T14:00:00Z'),
        endAt: new Date('2026-10-21T15:00:00Z'),
        sequence: 1,
        status: InterviewStatus.RESCHEDULED,
      });

      const res = await request(app)
        .patch('/api/interviews/interview-reschedule-uuid/reschedule')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          startAt: '2026-10-21T14:00:00Z',
          endAt: '2026-10-21T15:00:00Z',
          timeZone: 'UTC',
          reason: 'Interviewer emergency',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updatedData.sequence).toBe(1);
      expect(updatedData.status).toBe(InterviewStatus.RESCHEDULED);
      expect(historyCreated.reason).toBe('Interviewer emergency');
      expect(historyCreated.previousStatus).toBe(InterviewStatus.SCHEDULED);
      expect(historyCreated.nextStatus).toBe(InterviewStatus.RESCHEDULED);
    });

    it('cancelling sets status to cancelled and creates cancellation event with reason', async () => {
      const existingInterview = {
        id: 'interview-cancel-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        applicationId: 'app-1-uuid',
        candidateId: 'cand-1-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        type: InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'UTC',
        sequence: 0,
        candidate: sampleApplication.candidate,
        job: sampleApplication.job,
        client: sampleApplication.client,
        interviewer: mockUsers.interviewerOrgA,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.interview.findFirst as any).mockResolvedValueOnce(existingInterview);

      let cancelData: any = null;
      (prisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          interview: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              cancelData = data;
              return Promise.resolve({ ...existingInterview, ...data });
            }),
          },
          interviewHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-cancel' }),
          },
          activityLog: {
            create: vi.fn().mockResolvedValue({ id: 'act-cancel' }),
          },
          outboundCommunication: {
            create: vi.fn().mockResolvedValue({ id: 'comm-cancel' }),
          },
        };
        return cb(tx);
      });

      (prisma.interview.findFirst as any).mockResolvedValueOnce({
        ...existingInterview,
        status: InterviewStatus.CANCELLED,
        cancellationReason: 'Candidate accepted another offer',
        sequence: 1,
      });

      const res = await request(app)
        .patch('/api/interviews/interview-cancel-uuid/cancel')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({
          reason: 'Candidate accepted another offer',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(cancelData.status).toBe(InterviewStatus.CANCELLED);
      expect(cancelData.cancellationReason).toBe('Candidate accepted another offer');
      expect(cancelData.sequence).toBe(1);
    });

    it('rejects cancellation without reason with 400', async () => {
      const res = await request(app)
        .patch('/api/interviews/interview-cancel-uuid/cancel')
        .set('Authorization', 'Bearer auth-recruiter-a')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('4. Calendar .ics File Download (GET /api/interviews/:id/ics)', () => {
    it('returns downloadable RFC 5545 .ics iCalendar file with proper headers', async () => {
      (prisma.interview.findFirst as any).mockResolvedValue({
        id: 'interview-ics-uuid',
        organizationId: 'org-a-uuid',
        clientId: 'client-1-uuid',
        jobId: 'job-1-uuid',
        applicationId: 'app-1-uuid',
        candidateId: 'cand-1-uuid',
        interviewerUserProfileId: mockUsers.interviewerOrgA.id,
        type: InterviewType.VIDEO,
        status: InterviewStatus.SCHEDULED,
        startAt: new Date('2026-10-20T10:00:00Z'),
        endAt: new Date('2026-10-20T11:00:00Z'),
        timeZone: 'UTC',
        sequence: 0,
        meetingUrl: 'https://meet.google.com/xyz',
        candidate: sampleApplication.candidate,
        job: sampleApplication.job,
        client: sampleApplication.client,
        interviewer: mockUsers.interviewerOrgA,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .get('/api/interviews/interview-ics-uuid/ics')
        .set('Authorization', 'Bearer auth-recruiter-a');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['content-disposition']).toContain('interview-interview-ics-uuid.ics');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('UID:interview-interview-ics-uuid@hiredeskhr.com');
      expect(res.text).toContain('END:VCALENDAR');
    });
  });
});
