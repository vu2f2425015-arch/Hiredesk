import { prisma } from '@hiredesk/database';
import {
  UserRole,
  JobStatus,
  ApplicationStage,
  InterviewRequestStatus,
  InterviewStatus,
  ClientPortalShortlistInput,
  ClientPortalRejectInput,
  ClientPortalRequestInterviewInput,
  ClientPortalFeedbackInput,
  ClientPortalJobQueryInput,
  ClientPortalApplicationQueryInput,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { StorageService } from './storage.js';
import { generateIcsCalendar } from './calendar.js';
import { NotificationService } from './notifications.js';

export class ClientPortalService {
  /**
   * Helper to ensure caller is an active authenticated user with role `client`
   * and a verified clientId.
   */
  private static validateClientScope(user: AuthenticatedUser): { organizationId: string; clientId: string } {
    if (!user || user.role !== UserRole.CLIENT) {
      const err = new Error('Client portal access restricted to client role');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    if (!user.organizationId || !user.clientId) {
      const err = new Error('Client user has no active organization or client profile assigned');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    return {
      organizationId: user.organizationId,
      clientId: user.clientId,
    };
  }

  /**
   * GET /api/client-portal/me
   * Returns authenticated client context, company profile, and permissions.
   */
  static async getClientProfile(user: AuthenticatedUser) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
    });

    if (!client || client.status !== 'active') {
      const err = new Error('Client organization not found or inactive');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      user: {
        id: user.id,
        authUserId: user.authUserId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        clientId: user.clientId,
        clientName: user.clientName || client.name,
      },
      client: {
        id: client.id,
        name: client.name,
        contactEmail: client.contactEmail,
        status: client.status,
      },
    };
  }

  /**
   * GET /api/client-portal/jobs
   * Lists jobs assigned to authenticated client with applicant and review counts.
   */
  static async listAssignedJobs(user: AuthenticatedUser, query: ClientPortalJobQueryInput) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const where: any = {
      organizationId,
      clientId,
      status: JobStatus.PUBLISHED,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { department: { contains: query.search, mode: 'insensitive' } },
        { jobCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          applications: {
            select: { id: true, stage: true },
          },
        },
      }),
    ]);

    const jobs = items.map((job) => {
      const applicantCount = job.applications.length;
      const reviewCount = job.applications.filter((a) => a.stage === ApplicationStage.CLIENT_REVIEW).length;
      const shortlistedCount = job.applications.filter((a) => a.stage === ApplicationStage.SHORTLISTED).length;

      return {
        id: job.id,
        jobCode: job.jobCode,
        title: job.title,
        department: job.department,
        employmentType: job.employmentType,
        workplaceModel: job.workplaceModel,
        country: job.country,
        currency: job.currency,
        salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
        salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
        openings: job.openings,
        deadline: job.deadline ? job.deadline.toISOString() : null,
        status: job.status,
        description: job.description,
        requirements: job.requirements,
        skills: job.skills,
        applicantCount,
        reviewCount,
        shortlistedCount,
        createdAt: job.createdAt.toISOString(),
      };
    });

    return {
      jobs,
      total,
      page,
      limit,
    };
  }

  /**
   * GET /api/client-portal/jobs/:jobId/applications
   * Lists applications for an authorized client job with client-safe candidate DTOs.
   */
  static async listApplicationsForJob(
    user: AuthenticatedUser,
    jobId: string,
    query: ClientPortalApplicationQueryInput
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    // Non-disclosing 404 if job does not exist or does not belong to client
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        organizationId,
        clientId,
        status: JobStatus.PUBLISHED,
      },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const where: any = {
      jobId: job.id,
      organizationId,
      clientId,
    };

    if (query.stage) {
      where.stage = query.stage;
    }

    if (query.search) {
      where.candidate = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { normalizedEmail: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
          { candidateCode: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          candidate: {
            select: {
              id: true,
              candidateCode: true,
              name: true,
              normalizedEmail: true,
              phone: true,
              location: true,
              skills: true,
            },
          },
          resumes: {
            select: {
              id: true,
              originalFilename: true,
              fileSize: true,
              contentType: true,
              uploadedAt: true,
            },
          },
          stageHistories: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              previousStage: true,
              nextStage: true,
              reason: true,
              timestamp: true,
            },
          },
          interviewRequests: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              preferredTimes: true,
              notes: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    const applications = items.map((app) => ({
      id: app.id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      jobCode: job.jobCode,
      jobTitle: job.title,
      stage: app.stage,
      appliedAt: app.appliedAt.toISOString(),
      status: app.status,
      candidate: {
        id: app.candidate.id,
        candidateCode: app.candidate.candidateCode,
        name: app.candidate.name,
        email: app.candidate.normalizedEmail,
        phone: app.candidate.phone,
        location: app.candidate.location,
        skills: app.candidate.skills,
      },
      answers: app.answers || {},
      clientFeedback: app.clientFeedback,
      resumes: app.resumes.map((r) => ({
        id: r.id,
        originalFilename: r.originalFilename,
        fileSize: r.fileSize,
        contentType: r.contentType,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
      stageHistories: app.stageHistories.map((h) => ({
        id: h.id,
        previousStage: h.previousStage,
        nextStage: h.nextStage,
        reason: h.reason,
        timestamp: h.timestamp.toISOString(),
      })),
      interviewRequests: app.interviewRequests.map((ir) => ({
        id: ir.id,
        status: ir.status,
        preferredTimes: ir.preferredTimes as string[],
        notes: ir.notes,
        createdAt: ir.createdAt.toISOString(),
      })),
    }));

    return {
      job: {
        id: job.id,
        jobCode: job.jobCode,
        title: job.title,
      },
      applications,
      total,
      page,
      limit,
    };
  }

  /**
   * GET /api/client-portal/applications/:applicationId
   * Retrieves a client-safe application and candidate profile.
   * Strips recruiterNotes, private storage paths, raw mail payload, and internal logs.
   */
  static async getApplicationById(user: AuthenticatedUser, applicationId: string) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
      include: {
        job: {
          select: {
            id: true,
            jobCode: true,
            title: true,
            status: true,
          },
        },
        candidate: {
          select: {
            id: true,
            candidateCode: true,
            name: true,
            normalizedEmail: true,
            phone: true,
            location: true,
            skills: true,
            education: true,
            experience: true,
          },
        },
        resumes: {
          select: {
            id: true,
            originalFilename: true,
            fileSize: true,
            contentType: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'desc' },
        },
        stageHistories: {
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            previousStage: true,
            nextStage: true,
            reason: true,
            timestamp: true,
          },
        },
        interviewRequests: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            preferredTimes: true,
            notes: true,
            createdAt: true,
          },
        },
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      id: app.id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      jobCode: app.job.jobCode,
      jobTitle: app.job.title,
      stage: app.stage,
      appliedAt: app.appliedAt.toISOString(),
      status: app.status,
      candidate: {
        id: app.candidate.id,
        candidateCode: app.candidate.candidateCode,
        name: app.candidate.name,
        email: app.candidate.normalizedEmail,
        phone: app.candidate.phone,
        location: app.candidate.location,
        skills: app.candidate.skills,
        education: app.candidate.education,
        experience: app.candidate.experience,
      },
      answers: app.answers || {},
      clientFeedback: app.clientFeedback,
      resumes: app.resumes.map((r) => ({
        id: r.id,
        originalFilename: r.originalFilename,
        fileSize: r.fileSize,
        contentType: r.contentType,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
      stageHistories: app.stageHistories.map((h) => ({
        id: h.id,
        previousStage: h.previousStage,
        nextStage: h.nextStage,
        reason: h.reason,
        timestamp: h.timestamp.toISOString(),
      })),
      interviewRequests: app.interviewRequests.map((ir) => ({
        id: ir.id,
        status: ir.status,
        preferredTimes: ir.preferredTimes as string[],
        notes: ir.notes,
        createdAt: ir.createdAt.toISOString(),
      })),
    };
  }

  /**
   * POST /api/client-portal/applications/:applicationId/shortlist
   * Client review action: shortlists candidate if currently in Client Review stage.
   * Atomically records StageHistory and ActivityLog with idempotency support.
   */
  static async shortlistCandidate(
    user: AuthenticatedUser,
    applicationId: string,
    input: ClientPortalShortlistInput
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Idempotency: if already shortlisted, return safely without duplicating audit entries
    if (app.stage === ApplicationStage.SHORTLISTED) {
      return this.getApplicationById(user, app.id);
    }

    // Only allow shortlisting from Client Review stage
    if (app.stage !== ApplicationStage.CLIENT_REVIEW) {
      const err = new Error('Applications can only be shortlisted when in Client Review stage');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const previousStage = app.stage;
    const nextStage = ApplicationStage.SHORTLISTED;
    const reason = input.notes || 'Shortlisted by client review';

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: app.id },
        data: {
          stage: nextStage,
          updatedAt: new Date(),
        },
      });

      // Verify actor exists in user_profiles
      let actorIdToPersist: string | null = null;
      if (user.id) {
        const actor = await tx.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        });
        if (actor) {
          actorIdToPersist = actor.id;
        }
      }

      await tx.stageHistory.create({
        data: {
          applicationId: app.id,
          previousStage,
          nextStage,
          actorId: actorIdToPersist,
          reason,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: actorIdToPersist,
          entityType: 'application',
          entityId: app.id,
          action: 'client_shortlisted',
          details: {
            previousStage,
            nextStage,
            reason,
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
          },
          visibility: 'client_visible',
        },
      });
    }, { timeout: 35000, maxWait: 15000 });

    return this.getApplicationById(user, app.id);
  }

  /**
   * POST /api/client-portal/applications/:applicationId/reject
   * Client review action: rejects candidate with reason.
   * Atomically records StageHistory and ActivityLog with idempotency support.
   */
  static async rejectCandidate(
    user: AuthenticatedUser,
    applicationId: string,
    input: ClientPortalRejectInput
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Idempotency: if already rejected, return safely
    if (app.stage === ApplicationStage.REJECTED) {
      return this.getApplicationById(user, app.id);
    }

    // Client can reject when candidate is in Client Review or Shortlisted
    if (
      app.stage !== ApplicationStage.CLIENT_REVIEW &&
      app.stage !== ApplicationStage.SHORTLISTED
    ) {
      const err = new Error('Client can only reject applications currently in review or shortlisted');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const previousStage = app.stage;
    const nextStage = ApplicationStage.REJECTED;
    const reason = input.reason.trim();

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: app.id },
        data: {
          stage: nextStage,
          updatedAt: new Date(),
        },
      });

      let actorIdToPersist: string | null = null;
      if (user.id) {
        const actor = await tx.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        });
        if (actor) {
          actorIdToPersist = actor.id;
        }
      }

      await tx.stageHistory.create({
        data: {
          applicationId: app.id,
          previousStage,
          nextStage,
          actorId: actorIdToPersist,
          reason,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: actorIdToPersist,
          entityType: 'application',
          entityId: app.id,
          action: 'client_rejected',
          details: {
            previousStage,
            nextStage,
            reason,
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
          },
          visibility: 'client_visible',
        },
      });
    }, { timeout: 35000, maxWait: 15000 });

    return this.getApplicationById(user, app.id);
  }

  /**
   * POST /api/client-portal/applications/:applicationId/request-interview
   * Records a persisted, auditable InterviewRequest entity with status 'pending'.
   * Crucial distinction: This records a request, NOT a scheduled calendar event or sent invite.
   */
  static async requestInterview(
    user: AuthenticatedUser,
    applicationId: string,
    input: ClientPortalRequestInterviewInput
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Must be in Client Review or Shortlisted
    if (
      app.stage !== ApplicationStage.CLIENT_REVIEW &&
      app.stage !== ApplicationStage.SHORTLISTED
    ) {
      const err = new Error('Interview requests can only be submitted for applications in review or shortlisted');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const preferredTimes = input.preferredTimes || [];
    const notes = input.notes?.trim() || null;

    // Idempotency check: check if an active pending request already exists
    const existingPending = await prisma.interviewRequest.findFirst({
      where: {
        applicationId: app.id,
        status: InterviewRequestStatus.PENDING,
      },
    });

    if (existingPending) {
      // Return existing pending request cleanly
      return {
        id: existingPending.id,
        applicationId: app.id,
        jobId: app.jobId,
        clientId: app.clientId,
        status: InterviewRequestStatus.PENDING,
        preferredTimes: existingPending.preferredTimes as string[],
        notes: existingPending.notes,
        message: 'Interview request submitted. Your recruiter will coordinate scheduling.',
        createdAt: existingPending.createdAt.toISOString(),
      };
    }

    const request = await prisma.$transaction(async (tx) => {
      let actorIdToPersist: string | null = null;
      if (user.id) {
        const actor = await tx.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        });
        if (actor) {
          actorIdToPersist = actor.id;
        }
      }

      const created = await tx.interviewRequest.create({
        data: {
          applicationId: app.id,
          jobId: app.jobId,
          organizationId,
          clientId,
          requestedById: actorIdToPersist,
          status: InterviewRequestStatus.PENDING,
          preferredTimes,
          notes,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: actorIdToPersist,
          entityType: 'application',
          entityId: app.id,
          action: 'interview_requested',
          details: {
            interviewRequestId: created.id,
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
            preferredTimes,
            notes,
          },
          visibility: 'client_visible',
        },
      });

      // Dispatch internal notification to agency team (client users excluded)
      await NotificationService.notifyAgencyMembers(tx, organizationId, {
        type: 'interview_requested',
        title: 'Client Requested Interview',
        message: `Client requested an interview for ${app.candidate.name} (${app.job.title})`,
        entityType: 'application',
        entityId: app.id,
        actionUrl: `/applications/${app.id}`,
        eventKey: `interview_requested:${created.id}`,
        metadata: {
          jobCode: app.job.jobCode,
          candidateName: app.candidate.name,
          interviewRequestId: created.id,
        },
      });

      return created;
    }, { timeout: 35000, maxWait: 15000 });

    return {
      id: request.id,
      applicationId: app.id,
      jobId: app.jobId,
      clientId: app.clientId,
      status: InterviewRequestStatus.PENDING,
      preferredTimes: request.preferredTimes as string[],
      notes: request.notes,
      message: 'Interview request submitted. Your recruiter will coordinate scheduling.',
      createdAt: request.createdAt.toISOString(),
    };
  }

  /**
   * POST /api/client-portal/applications/:applicationId/feedback
   * Adds client review feedback without modifying or leaking recruiterNotes.
   */
  static async submitFeedback(
    user: AuthenticatedUser,
    applicationId: string,
    input: ClientPortalFeedbackInput
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const feedback = input.feedback.trim();

    await prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: app.id },
        data: {
          clientFeedback: feedback,
          updatedAt: new Date(),
        },
      });

      let actorIdToPersist: string | null = null;
      if (user.id) {
        const actor = await tx.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        });
        if (actor) {
          actorIdToPersist = actor.id;
        }
      }

      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: actorIdToPersist,
          entityType: 'application',
          entityId: app.id,
          action: 'client_feedback_submitted',
          details: {
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
          },
          visibility: 'client_visible',
        },
      });

      // Dispatch internal notification to agency team (client users excluded)
      await NotificationService.notifyAgencyMembers(tx, organizationId, {
        type: 'client_feedback',
        title: 'Client Feedback Submitted',
        message: `Client provided feedback for ${app.candidate.name} (${app.job.title})`,
        entityType: 'application',
        entityId: app.id,
        actionUrl: `/applications/${app.id}`,
        metadata: {
          jobCode: app.job.jobCode,
          candidateName: app.candidate.name,
          feedbackSnippet: feedback.slice(0, 100),
        },
      });
    }, { timeout: 35000, maxWait: 15000 });

    return this.getApplicationById(user, app.id);
  }

  /**
   * GET /api/client-portal/applications/:applicationId/resume
   * Generates a short-lived 60-second signed URL for authorized client resume preview/download.
   * Returns non-disclosing 404 if application or resume does not belong to client.
   */
  static async getSignedResumeUrl(user: AuthenticatedUser, applicationId: string) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const app = await prisma.application.findFirst({
      where: {
        id: applicationId,
        organizationId,
        clientId,
      },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const resume = await prisma.resume.findFirst({
      where: {
        applicationId: app.id,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!resume) {
      const err = new Error('Resume not found for this application');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const signedUrl = await StorageService.getSignedResumeUrl(resume.storagePath, 60);

    return {
      signedUrl,
      filename: resume.originalFilename,
      expiresIn: 60,
    };
  }

  /**
   * GET /api/client-portal/interviews
   * Lists scheduled and historical interviews strictly for the authenticated client's jobs.
   */
  static async listScheduledInterviews(
    user: AuthenticatedUser,
    query?: { status?: string; jobId?: string; page?: number; limit?: number }
  ) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const where: any = {
      organizationId,
      clientId,
    };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.jobId) {
      where.jobId = query.jobId;
    }

    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
        include: {
          candidate: {
            select: { id: true, name: true, candidateCode: true },
          },
          job: {
            select: { id: true, jobCode: true, title: true },
          },
          interviewer: {
            select: { id: true, fullName: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.interview.count({ where }),
    ]);

    const formatted = interviews.map((i: any) => ({
      id: i.id,
      applicationId: i.applicationId,
      jobId: i.jobId,
      candidateId: i.candidateId,
      status: i.status,
      type: i.type,
      startAt: i.startAt.toISOString(),
      endAt: i.endAt.toISOString(),
      timeZone: i.timeZone,
      meetingProvider: i.meetingProvider,
      meetingUrl: i.meetingUrl,
      location: i.location,
      feedback: i.feedback,
      result: i.result,
      candidate: i.candidate,
      job: i.job,
      interviewer: i.interviewer,
      interviewerNotes: undefined, // Strictly redacted from client view
      createdAt: i.createdAt.toISOString(),
    }));

    return { interviews: formatted, total, page, limit };
  }

  /**
   * GET /api/client-portal/interviews/:id
   * Single interview details with strict client scoping and notes redaction.
   */
  static async getScheduledInterview(user: AuthenticatedUser, id: string) {
    const { organizationId, clientId } = this.validateClientScope(user);

    const interview = await prisma.interview.findFirst({
      where: {
        id,
        organizationId,
        clientId,
      },
      include: {
        candidate: {
          select: { id: true, name: true, candidateCode: true },
        },
        job: {
          select: { id: true, jobCode: true, title: true },
        },
        interviewer: {
          select: { id: true, fullName: true, firstName: true, lastName: true },
        },
      },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      id: interview.id,
      applicationId: interview.applicationId,
      jobId: interview.jobId,
      candidateId: interview.candidateId,
      status: interview.status,
      type: interview.type,
      startAt: interview.startAt.toISOString(),
      endAt: interview.endAt.toISOString(),
      timeZone: interview.timeZone,
      meetingProvider: interview.meetingProvider,
      meetingUrl: interview.meetingUrl,
      location: interview.location,
      feedback: interview.feedback,
      result: interview.result,
      candidate: interview.candidate,
      job: interview.job,
      interviewer: interview.interviewer,
      interviewerNotes: undefined, // Redacted
      createdAt: interview.createdAt.toISOString(),
    };
  }

  /**
   * Download RFC 5545 iCalendar content for an interview from client portal
   */
  static async getScheduledInterviewIcs(user: AuthenticatedUser, id: string): Promise<string> {
    const { organizationId, clientId } = this.validateClientScope(user);

    const interview = await prisma.interview.findFirst({
      where: {
        id,
        organizationId,
        clientId,
      },
      include: {
        candidate: {
          select: { id: true, name: true, candidateCode: true, normalizedEmail: true },
        },
        job: {
          select: { id: true, jobCode: true, title: true },
        },
        interviewer: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return generateIcsCalendar({
      interviewId: interview.id,
      sequence: interview.sequence,
      summary: `Interview: ${interview.job.title} (${interview.job.jobCode})`,
      description: `Interview with ${interview.candidate.name}.\nMode: ${interview.type}\nTime Zone: ${interview.timeZone}`,
      startAt: new Date(interview.startAt),
      endAt: new Date(interview.endAt),
      location: interview.location,
      url: interview.meetingUrl,
      organizerName: interview.interviewer.fullName || `${interview.interviewer.firstName} ${interview.interviewer.lastName}`,
      organizerEmail: interview.interviewer.email || 'noreply@hiredeskhr.com',
      attendeeName: interview.candidate.name,
      attendeeEmail: interview.candidate.normalizedEmail,
      isCancellation: interview.status === InterviewStatus.CANCELLED,
    });
  }
}

