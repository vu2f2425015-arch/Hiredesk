import { prisma, allocateNextCandidateCode } from '@hiredesk/database';
import {
  PublicApplyInput,
  ApplicationQueryInput,
  CandidateQueryInput,
  StageTransitionInput,
  UpdateNotesInput,
  ApplicationStage,
  JobStatus,
  UserRole,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { StorageService, validateUploadedFile } from './storage.js';
import { logger } from '../utils/logger.js';

export interface PublicApplyResult {
  applicationId: string;
  candidateCode: string;
  status: string;
  message: string;
  isDuplicate?: boolean;
}

export class ApplicationService {
  /**
   * Public application submission flow with resume upload, candidate deduplication,
   * and safe application idempotency.
   */
  static async submitPublicApplication(
    orgSlug: string,
    jobCode: string,
    input: PublicApplyInput,
    file?: Express.Multer.File
  ): Promise<PublicApplyResult> {
    // 1. Spam trap / Honeypot verification
    if (input.honeypot && input.honeypot.trim().length > 0) {
      const err = new Error('Invalid submission detected');
      (err as any).statusCode = 400;
      (err as any).code = 'SPAM_DETECTED';
      throw err;
    }

    // 2. Validate resume file
    if (!file || !file.buffer || file.buffer.length === 0) {
      const err = new Error('Resume file is required');
      (err as any).statusCode = 400;
      (err as any).code = 'RESUME_REQUIRED';
      throw err;
    }

    const validation = validateUploadedFile(file);
    if (!validation.isValid) {
      const err = new Error(validation.error || 'Invalid resume file');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_FILE';
      throw err;
    }

    // 3. Resolve Organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!organization || organization.status !== 'active') {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 4. Resolve Job by jobCode within the resolved organization
    const job = await prisma.job.findFirst({
      where: {
        jobCode,
        organizationId: organization.id,
      },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 5. Enforce that only PUBLISHED jobs accept applications
    if (job.status !== JobStatus.PUBLISHED) {
      const err = new Error('This job is no longer accepting applications');
      (err as any).statusCode = 400;
      (err as any).code = 'JOB_NOT_PUBLISHED';
      throw err;
    }

    // 6. Conservative Email Normalization
    const normalizedEmail = input.email.trim().toLowerCase();

    // 7. Find or Create Candidate (Scoped to Organization)
    let candidate = await prisma.candidate.findUnique({
      where: {
        organizationId_normalizedEmail: {
          organizationId: organization.id,
          normalizedEmail,
        },
      },
    });

    if (candidate) {
      // Reuse existing candidate profile without overwriting data with empty values
      if (input.phone && !candidate.phone) {
        candidate = await prisma.candidate.update({
          where: { id: candidate.id },
          data: { phone: input.phone },
        });
      }
    } else {
      // Allocate atomic candidate code (e.g. CAND-1001)
      const candidateCode = await allocateNextCandidateCode(prisma);

      try {
        candidate = await prisma.candidate.create({
          data: {
            organizationId: organization.id,
            candidateCode,
            normalizedEmail,
            name: input.name.trim(),
            phone: input.phone?.trim() || null,
          },
        });
      } catch (e: any) {
        // Race condition handler: concurrent submission for the same candidate email
        if (e.code === 'P2002') {
          const reread = await prisma.candidate.findUnique({
            where: {
              organizationId_normalizedEmail: {
                organizationId: organization.id,
                normalizedEmail,
              },
            },
          });
          if (reread) {
            candidate = reread;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    // 8. Application Idempotency Check
    // If the candidate already applied for this specific job, return idempotent success
    const existingApplication = await prisma.application.findUnique({
      where: {
        jobId_candidateId: {
          jobId: job.id,
          candidateId: candidate.id,
        },
      },
    });

    if (existingApplication) {
      logger.info(
        { candidateId: candidate.id, jobId: job.id, applicationId: existingApplication.id },
        'Idempotent application retry detected; returning existing application confirmation'
      );
      return {
        applicationId: existingApplication.id,
        candidateCode: candidate.candidateCode,
        status: 'received',
        message: 'Your application has already been received for this position',
        isDuplicate: true,
      };
    }

    // 9. Upload Resume to Supabase Storage
    const uploadResult = await StorageService.uploadResume({
      organizationId: organization.id,
      candidateId: candidate.id,
      buffer: file.buffer,
      extension: validation.extension,
      contentType: validation.mimeType,
    });

    // 10. Persist Application, Resume Metadata, and Initial Stage in Database Transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        const app = await tx.application.create({
          data: {
            organizationId: organization.id,
            jobId: job.id,
            candidateId: candidate.id,
            clientId: job.clientId,
            stage: 'Applied',
            source: 'career_page',
            status: 'active',
            answers: (input.answers as any) || {},
          },
        });

        await tx.resume.create({
          data: {
            candidateId: candidate.id,
            applicationId: app.id,
            bucket: StorageService.BUCKET,
            storagePath: uploadResult.storagePath,
            originalFilename: validation.sanitizedFilename,
            safeFilename: uploadResult.safeFilename,
            contentType: validation.mimeType,
            fileSize: uploadResult.fileSize,
            checksum: uploadResult.checksum,
            parsingStatus: 'pending',
          },
        });

        await tx.stageHistory.create({
          data: {
            applicationId: app.id,
            previousStage: 'None',
            nextStage: 'Applied',
            reason: 'Initial public application submission via career portal',
          },
        });

        return app;
      });

      return {
        applicationId: result.id,
        candidateCode: candidate.candidateCode,
        status: 'received',
        message: 'Application submitted successfully',
      };
    } catch (dbError) {
      // 11. Partial failure cleanup: delete orphaned storage object if database write failed
      logger.error({ err: dbError, storagePath: uploadResult.storagePath }, 'Database write failed; removing uploaded resume file');
      await StorageService.deleteResume(uploadResult.storagePath).catch((cleanupErr) => {
        logger.error({ err: cleanupErr }, 'Failed to clean up orphaned storage object after database error');
      });
      throw dbError;
    }
  }

  /**
   * Lists applications for a specific job, scoped by tenant and caller role.
   */
  static async listApplicationsForJob(
    user: AuthenticatedUser,
    jobId: string,
    query: ApplicationQueryInput
  ) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && job.organizationId !== user.organizationId) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check
    if (user.role === UserRole.CLIENT) {
      if (job.clientId !== user.clientId) {
        const err = new Error('Job not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }
    }

    const where: any = {
      jobId: job.id,
      organizationId: job.organizationId,
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
        },
      }),
    ]);

    const applications = items.map((app) => ({
      id: app.id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      organizationId: app.organizationId,
      clientId: app.clientId,
      stage: app.stage,
      source: app.source,
      appliedAt: app.appliedAt.toISOString(),
      status: app.status,
      answers: app.answers,
      candidate: {
        id: app.candidate.id,
        candidateCode: app.candidate.candidateCode,
        name: app.candidate.name,
        email: app.candidate.normalizedEmail,
        phone: app.candidate.phone,
        location: app.candidate.location,
      },
      resumes: app.resumes.map((r) => ({
        id: r.id,
        originalFilename: r.originalFilename,
        fileSize: r.fileSize,
        contentType: r.contentType,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
    }));

    return {
      applications,
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single application with authorization check,
   * chronologically ordered stage histories, and client-sensitive note redaction.
   */
  static async getApplicationById(user: AuthenticatedUser, applicationId: string) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: true,
        job: {
          select: { id: true, jobCode: true, title: true, organizationId: true, clientId: true },
        },
        resumes: true,
        interviewRequests: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, preferredTimes: true, notes: true, createdAt: true },
        },
        stageHistories: {
          orderBy: { timestamp: 'asc' },
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true, role: true },
            },
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

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && app.organizationId !== user.organizationId) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check
    if (user.role === UserRole.CLIENT && app.clientId !== user.clientId) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Hard separation: client role must NEVER see internal recruiterNotes or raw resume storage paths
    if (user.role === UserRole.CLIENT) {
      const { recruiterNotes: _rn, ...safeApp } = app;
      return {
        ...safeApp,
        resumes: (safeApp.resumes || []).map((r: any) => ({
          id: r.id,
          originalFilename: r.originalFilename,
          fileSize: r.fileSize,
          contentType: r.contentType,
          uploadedAt: r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : r.uploadedAt,
        })),
      };
    }

    return app;
  }

  /**
   * Transitions an application's stage, creating StageHistory and ActivityLog atomically in a transaction.
   */
  static async transitionStage(
    user: AuthenticatedUser,
    applicationId: string,
    input: StageTransitionInput
  ) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
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

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && app.organizationId !== user.organizationId) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check:
    // Clients can only act on applications currently in 'Client Review' stage
    if (user.role === UserRole.CLIENT) {
      if (app.clientId !== user.clientId) {
        const err = new Error('Application not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }

      if (app.stage !== ApplicationStage.CLIENT_REVIEW) {
        const err = new Error('Client users can only transition applications currently in Client Review');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
    }

    const previousStage = app.stage;
    const nextStage = input.stage;

    // Atomically update Application, insert StageHistory, and insert ActivityLog
    const updated = await prisma.$transaction(async (tx) => {
      const updatedApp = await tx.application.update({
        where: { id: app.id },
        data: {
          stage: nextStage,
          updatedAt: new Date(),
        },
      });

      // Ensure actorId satisfies foreign key constraint or null for system/unregistered callers
      let actorIdToPersist: string | null = null;
      if (user.id && (tx as any).userProfile?.findUnique) {
        const actorProfile = await tx.userProfile.findUnique({
          where: { id: user.id },
          select: { id: true },
        });
        if (actorProfile) {
          actorIdToPersist = actorProfile.id;
        }
      }

      await tx.stageHistory.create({
        data: {
          applicationId: app.id,
          previousStage,
          nextStage,
          actorId: actorIdToPersist,
          reason: input.reason || `Stage updated from ${previousStage} to ${nextStage} by ${user.role}`,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: app.organizationId,
          actorId: user.id,
          entityType: 'application',
          entityId: app.id,
          action: 'stage_transition',
          details: {
            fromStage: previousStage,
            toStage: nextStage,
            reason: input.reason || null,
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
          },
          visibility: user.role === UserRole.CLIENT ? 'client_visible' : 'internal',
        },
      });

      return updatedApp;
    });

    return ApplicationService.getApplicationById(user, updated.id);
  }

  /**
   * Updates internal recruiter notes and/or client feedback with strict role enforcement.
   */
  static async updateApplicationNotes(
    user: AuthenticatedUser,
    applicationId: string,
    input: UpdateNotesInput
  ) {
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true, candidate: true },
    });

    if (!app) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && app.organizationId !== user.organizationId) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check
    if (user.role === UserRole.CLIENT) {
      if (app.clientId !== user.clientId) {
        const err = new Error('Application not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }

      // Hard check: client user cannot edit internal recruiter notes
      if (input.recruiterNotes !== undefined) {
        const err = new Error('Client users cannot modify internal recruiter notes');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
    }

    const data: any = { updatedAt: new Date() };
    if (input.recruiterNotes !== undefined && user.role !== UserRole.CLIENT) {
      data.recruiterNotes = input.recruiterNotes;
    }
    if (input.clientFeedback !== undefined) {
      data.clientFeedback = input.clientFeedback;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.application.update({
        where: { id: app.id },
        data,
      });

      await tx.activityLog.create({
        data: {
          organizationId: app.organizationId,
          actorId: user.id,
          entityType: 'application',
          entityId: app.id,
          action: 'application_notes_updated',
          details: {
            hasRecruiterNotes: input.recruiterNotes !== undefined,
            hasClientFeedback: input.clientFeedback !== undefined,
            jobCode: app.job.jobCode,
            candidateCode: app.candidate.candidateCode,
          },
          visibility: input.clientFeedback !== undefined ? 'client_visible' : 'internal',
        },
      });

      return res;
    });

    return ApplicationService.getApplicationById(user, updated.id);
  }

  /**
   * Retrieves all applications for a specific job grouped by pipeline stage.
   */
  static async listPipelineForJob(user: AuthenticatedUser, jobId: string) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { client: { select: { id: true, name: true } } },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && job.organizationId !== user.organizationId) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check
    if (user.role === UserRole.CLIENT && job.clientId !== user.clientId) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const applications = await prisma.application.findMany({
      where: {
        jobId: job.id,
        organizationId: job.organizationId,
      },
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
          take: 1,
          select: { timestamp: true, reason: true },
        },
        interviewRequests: {
          where: { status: 'pending' },
          select: { id: true, status: true, preferredTimes: true, notes: true, createdAt: true },
        },
      },
    });

    // Group by canonical stages
    const stages: Record<string, any[]> = {
      [ApplicationStage.APPLIED]: [],
      [ApplicationStage.SCREENING]: [],
      [ApplicationStage.SHORTLISTED]: [],
      [ApplicationStage.INTERVIEW]: [],
      [ApplicationStage.AI_INTERVIEW]: [],
      [ApplicationStage.CLIENT_REVIEW]: [],
      [ApplicationStage.SELECTED]: [],
      [ApplicationStage.HIRED]: [],
      [ApplicationStage.REJECTED]: [],
      [ApplicationStage.WITHDRAWN]: [],
    };

    for (const app of applications) {
      const interviewReqs = (app as any).interviewRequests || [];
      const safeApp = {
        id: app.id,
        candidateId: app.candidateId,
        jobId: app.jobId,
        stage: app.stage,
        source: app.source,
        appliedAt: app.appliedAt.toISOString(),
        clientFeedback: app.clientFeedback,
        recruiterNotes: user.role === UserRole.CLIENT ? undefined : app.recruiterNotes,
        candidate: app.candidate,
        resumes: app.resumes.map((r) => ({
          ...r,
          uploadedAt: r.uploadedAt.toISOString(),
        })),
        lastStageChange: app.stageHistories[0]
          ? {
              timestamp: app.stageHistories[0].timestamp.toISOString(),
              reason: app.stageHistories[0].reason,
            }
          : null,
        interviewRequests: interviewReqs.map((ir: any) => ({
          id: ir.id,
          status: ir.status,
          preferredTimes: ir.preferredTimes,
          notes: ir.notes,
          createdAt: ir.createdAt instanceof Date ? ir.createdAt.toISOString() : ir.createdAt,
        })),
        hasPendingInterviewRequest: interviewReqs.length > 0,
      };

      if (stages[app.stage]) {
        stages[app.stage].push(safeApp);
      } else {
        stages[app.stage] = [safeApp];
      }
    }

    const counts: Record<string, number> = {};
    for (const [stageName, appList] of Object.entries(stages)) {
      counts[stageName] = appList.length;
    }

    return {
      job: {
        id: job.id,
        jobCode: job.jobCode,
        title: job.title,
        status: job.status,
        client: job.client,
      },
      stages,
      counts,
      totalApplications: applications.length,
    };
  }

  /**
   * Retrieves candidate profile including all multi-job applications within authorized scope.
   */
  static async getCandidateById(user: AuthenticatedUser, candidateId: string) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        resumes: {
          orderBy: { uploadedAt: 'desc' },
        },
        applications: {
          orderBy: { appliedAt: 'desc' },
          include: {
            job: {
              select: {
                id: true,
                jobCode: true,
                title: true,
                status: true,
                clientId: true,
                client: { select: { name: true } },
              },
            },
            resumes: true,
            stageHistories: {
              orderBy: { timestamp: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!candidate) {
      const err = new Error('Candidate not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && candidate.organizationId !== user.organizationId) {
      const err = new Error('Candidate not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client role boundary check
    if (user.role === UserRole.CLIENT) {
      // Must have applied to at least one job belonging to user.clientId
      const hasClientJob = candidate.applications.some((a) => a.clientId === user.clientId);
      if (!hasClientJob) {
        const err = new Error('Candidate not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }
    }

    // Filter applications if client user
    const filteredApplications = candidate.applications
      .filter((app) => {
        if (user.role === UserRole.CLIENT) {
          return app.clientId === user.clientId;
        }
        return true;
      })
      .map((app) => ({
        id: app.id,
        jobId: app.jobId,
        stage: app.stage,
        source: app.source,
        appliedAt: app.appliedAt.toISOString(),
        clientFeedback: app.clientFeedback,
        recruiterNotes: user.role === UserRole.CLIENT ? undefined : app.recruiterNotes,
        job: app.job,
        resumes: app.resumes,
        lastStageChange: app.stageHistories[0] || null,
      }));

    return {
      id: candidate.id,
      candidateCode: candidate.candidateCode,
      name: candidate.name,
      email: candidate.normalizedEmail,
      phone: candidate.phone,
      location: candidate.location,
      country: candidate.country,
      skills: candidate.skills,
      education: candidate.education,
      experience: candidate.experience,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      applications: filteredApplications,
      resumes: candidate.resumes.map((r: any) => ({
        id: r.id,
        originalFilename: r.originalFilename,
        fileSize: r.fileSize,
        contentType: r.contentType,
        uploadedAt: r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : r.uploadedAt,
      })),
    };
  }

  /**
   * Lists / searches candidates within caller's organization.
   */
  static async listCandidates(user: AuthenticatedUser, query: CandidateQueryInput) {
    if (user.role === UserRole.CLIENT) {
      // Client users list candidates who have applied to client's jobs
      const appWhere = {
        clientId: user.clientId!,
        organizationId: user.organizationId!,
      };
      const candidateIds = await prisma.application
        .groupBy({ by: ['candidateId'], where: appWhere })
        .then((rows) => rows.map((r) => r.candidateId));

      const where: any = {
        id: { in: candidateIds },
      };

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { normalizedEmail: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
          { candidateCode: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [total, items] = await Promise.all([
        prisma.candidate.count({ where }),
        prisma.candidate.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            applications: {
              where: { clientId: user.clientId || undefined },
              select: { id: true, stage: true, jobId: true },
            },
          },
        }),
      ]);

      return {
        candidates: items.map((c) => ({
          id: c.id,
          candidateCode: c.candidateCode,
          name: c.name,
          email: c.normalizedEmail,
          phone: c.phone,
          location: c.location,
          skills: c.skills,
          applicationsCount: c.applications.length,
          createdAt: c.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
      };
    }

    // Manager / Recruiter / Super Admin
    const where: any = {};
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.organizationId = user.organizationId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { normalizedEmail: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
        { candidateCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { applications: true } },
        },
      }),
    ]);

    return {
      candidates: items.map((c) => ({
        id: c.id,
        candidateCode: c.candidateCode,
        name: c.name,
        email: c.normalizedEmail,
        phone: c.phone,
        location: c.location,
        skills: c.skills,
        applicationsCount: c._count.applications,
        createdAt: c.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Generates a 60-second signed URL for authorized resume download.
   */
  static async getSignedResumeDownloadUrl(user: AuthenticatedUser, applicationId: string) {
    const app = await ApplicationService.getApplicationById(user, applicationId);

    const resume = await prisma.resume.findFirst({
      where: {
        applicationId: app.id,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    if (!resume) {
      const err = new Error('No resume file found for this application');
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
}

