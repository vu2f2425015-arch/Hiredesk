import { prisma, allocateNextCandidateCode } from '@hiredesk/database';
import {
  InboundQueryInput,
  ManualAssignInput,
  InboundStatus,
  UserRole,
  JobStatus,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

export function serializeInboundRecord(record: any) {
  if (!record) return null;
  return {
    ...record,
    uidValidity: record.uidValidity !== undefined && record.uidValidity !== null ? record.uidValidity.toString() : null,
    uid: record.uid !== undefined && record.uid !== null ? record.uid.toString() : null,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    receivedAt: record.receivedAt?.toISOString?.() ?? record.receivedAt,
    processedAt: record.processedAt?.toISOString?.() ?? record.processedAt,
    lastAttemptAt: record.lastAttemptAt?.toISOString?.() ?? record.lastAttemptAt,
  };
}

export class InboundService {
  /**
   * Lists inbound application records with tenant filtering and role isolation.
   */
  static async listInboundApplications(user: AuthenticatedUser, query: InboundQueryInput) {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client role is not authorized to access inbound queue');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const where: any = {};

    // Tenancy isolation: super_admin sees all; manager/recruiter only see records with their matchedOrgId
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!user.organizationId) {
        const err = new Error('User has no associated organization');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
      where.matchedOrgId = user.organizationId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.jobCode) {
      where.extractedJobCode = query.jobCode;
    }

    if (query.search) {
      where.OR = [
        { subject: { contains: query.search, mode: 'insensitive' } },
        { senderEmail: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
        { recipientEmail: { contains: query.search.toLowerCase(), mode: 'insensitive' } },
        { extractedJobCode: { contains: query.search.toUpperCase(), mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.inboundApplication.count({ where }),
      prisma.inboundApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: 'desc' },
      }),
    ]);

    return {
      items: items.map(serializeInboundRecord),
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single inbound application by ID with strict tenant boundary check.
   */
  static async getInboundApplicationById(user: AuthenticatedUser, id: string) {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client role is not authorized to access inbound queue');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const record = await prisma.inboundApplication.findUnique({
      where: { id },
    });

    if (!record) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenancy check: return 404 for unauthorized cross-tenant requests
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (!record.matchedOrgId || record.matchedOrgId !== user.organizationId) {
        const err = new Error('Inbound application not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }
    }

    return serializeInboundRecord(record);
  }

  /**
   * Platform Administrator (or authorized Manager) manually assigns an unmatched email to a live Job.
   */
  static async manualAssign(user: AuthenticatedUser, inboundId: string, input: ManualAssignInput) {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client role is not authorized to access inbound queue');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const record = await prisma.inboundApplication.findUnique({
      where: { id: inboundId },
    });

    if (!record) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // If tenant ownership is unassigned (matchedOrgId == null), only Super Admin may assign it
    if (!record.matchedOrgId && user.role !== UserRole.SUPER_ADMIN) {
      const err = new Error('Only super administrators can assign unassigned inbound applications');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    // If matchedOrgId is already established, caller must match
    if (record.matchedOrgId && user.role !== UserRole.SUPER_ADMIN) {
      if (record.matchedOrgId !== user.organizationId) {
        const err = new Error('Inbound application not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }
    }

    // 1. Verify target Job
    const targetJob = await prisma.job.findUnique({
      where: { id: input.jobId },
    });

    if (!targetJob) {
      const err = new Error('Target job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (targetJob.status !== JobStatus.PUBLISHED) {
      const err = new Error('Target job is not currently accepting applications');
      (err as any).statusCode = 400;
      (err as any).code = 'JOB_NOT_PUBLISHED';
      throw err;
    }

    // If caller is not Super Admin, job must belong to their organization
    if (user.role !== UserRole.SUPER_ADMIN && targetJob.organizationId !== user.organizationId) {
      const err = new Error('Target job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const organizationId = targetJob.organizationId;
    const clientId = targetJob.clientId;

    // 2. Candidate resolution (derive from senderEmail or rawPayload)
    const normalizedEmail = record.senderEmail.trim().toLowerCase();
    const candidateName = record.senderName?.trim() || normalizedEmail.split('@')[0];

    let candidate = await prisma.candidate.findUnique({
      where: {
        organizationId_normalizedEmail: {
          organizationId,
          normalizedEmail,
        },
      },
    });

    if (!candidate) {
      const candidateCode = await allocateNextCandidateCode(prisma);
      try {
        candidate = await prisma.candidate.create({
          data: {
            organizationId,
            candidateCode,
            normalizedEmail,
            name: candidateName,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') {
          candidate = await prisma.candidate.findUnique({
            where: {
              organizationId_normalizedEmail: {
                organizationId,
                normalizedEmail,
              },
            },
          });
          if (!candidate) throw e;
        } else {
          throw e;
        }
      }
    }

    // 3. Application Idempotency Check
    const existingApp = await prisma.application.findUnique({
      where: {
        jobId_candidateId: {
          jobId: targetJob.id,
          candidateId: candidate.id,
        },
      },
    });

    if (existingApp) {
      logger.info(
        { inboundId: record.id, jobId: targetJob.id, candidateId: candidate.id, appId: existingApp.id },
        'Manual assignment: application already exists, marking duplicate'
      );

      const updated = await prisma.inboundApplication.update({
        where: { id: record.id },
        data: {
          status: InboundStatus.DUPLICATE,
          extractedJobCode: targetJob.jobCode,
          matchedJobId: targetJob.id,
          matchedOrgId: organizationId,
          matchedClientId: clientId,
          linkedCandidateId: candidate.id,
          linkedApplicationId: existingApp.id,
          failureReason: 'duplicate_application',
          processedAt: new Date(),
        },
      });

      return serializeInboundRecord(updated);
    }

    // 4. Create Application and link in transaction
    const updated = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          organizationId,
          clientId,
          jobId: targetJob.id,
          candidateId: candidate.id,
          stage: 'Applied',
          source: 'manual_assignment',
          status: 'active',
          answers: {
            manuallyAssignedBy: user.id,
            inboundApplicationId: record.id,
          },
        },
      });

      await tx.stageHistory.create({
        data: {
          applicationId: app.id,
          previousStage: 'None',
          nextStage: 'Applied',
          actorId: user.id,
          reason: `Manual job assignment by ${user.role} to job ${targetJob.jobCode}`,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: user.id,
          entityType: 'application',
          entityId: app.id,
          action: 'inbound_manual_assignment',
          details: {
            jobCode: targetJob.jobCode,
            inboundApplicationId: record.id,
          },
        },
      });

      return tx.inboundApplication.update({
        where: { id: record.id },
        data: {
          status: InboundStatus.MATCHED,
          extractedJobCode: targetJob.jobCode,
          matchedJobId: targetJob.id,
          matchedOrgId: organizationId,
          matchedClientId: clientId,
          linkedCandidateId: candidate.id,
          linkedApplicationId: app.id,
          failureReason: null,
          processedAt: new Date(),
        },
      });
    }, { timeout: 35000, maxWait: 15000 });

    return serializeInboundRecord(updated);
  }

  /**
   * Retries processing for a failed or unmatched inbound message.
   */
  static async retry(user: AuthenticatedUser, inboundId: string) {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client role is not authorized to access inbound queue');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const record = await prisma.inboundApplication.findUnique({
      where: { id: inboundId },
    });

    if (!record) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (user.role !== UserRole.SUPER_ADMIN && record.matchedOrgId !== user.organizationId) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (record.status === InboundStatus.MATCHED || record.status === InboundStatus.DUPLICATE) {
      return serializeInboundRecord(record);
    }

    const updated = await prisma.inboundApplication.update({
      where: { id: record.id },
      data: {
        status: InboundStatus.RETRYING,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

    return serializeInboundRecord(updated);
  }

  /**
   * Marks an inbound application as ignored with an explicit reason.
   */
  static async ignore(user: AuthenticatedUser, inboundId: string, reason: string) {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client role is not authorized to access inbound queue');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const record = await prisma.inboundApplication.findUnique({
      where: { id: inboundId },
    });

    if (!record) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (user.role !== UserRole.SUPER_ADMIN && record.matchedOrgId && record.matchedOrgId !== user.organizationId) {
      const err = new Error('Inbound application not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const updated = await prisma.inboundApplication.update({
      where: { id: record.id },
      data: {
        status: InboundStatus.IGNORED,
        failureReason: reason,
        processedAt: new Date(),
      },
    });

    if (record.matchedOrgId) {
      await prisma.activityLog.create({
        data: {
          organizationId: record.matchedOrgId,
          actorId: user.id,
          entityType: 'inbound_application',
          entityId: record.id,
          action: 'inbound_ignored',
          details: { reason },
        },
      });
    }

    return serializeInboundRecord(updated);
  }
}
