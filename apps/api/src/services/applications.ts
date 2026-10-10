import { prisma, allocateNextCandidateCode } from '@hiredesk/database';
import {
  PublicApplyInput,
  ApplicationQueryInput,
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
   * Retrieves single application with authorization check.
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

    return app;
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
