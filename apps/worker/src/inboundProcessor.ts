import { prisma, allocateNextCandidateCode, PrismaClient } from '@hiredesk/database';
import { InboundStatus, JobStatus, INBOUND_FAILURE_REASONS } from '@hiredesk/shared';
import { parseApplicationEmail, ParsedApplicationEmail } from './emailParser.js';
import { WorkerStorageService, validateAttachment } from './storage.js';
import { logger } from './logger.js';

export interface InboundRecordInput {
  mailboxId: string;
  uidValidity: bigint;
  uid: bigint;
  messageId?: string | null;
  subject: string;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail: string;
  receivedAt: Date;
  rawEmail?: Buffer | string;
  rawPayload?: any;
}

export interface ProcessingResult {
  inboundId: string;
  status: InboundStatus;
  jobCode?: string | null;
  matchedJobId?: string | null;
  matchedOrgId?: string | null;
  candidateId?: string | null;
  applicationId?: string | null;
  failureReason?: string | null;
  isDuplicate?: boolean;
}

const LEASE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Idempotently saves or claims an inbound message record in the database.
 */
export async function claimOrRegisterInboundRecord(
  input: InboundRecordInput,
  client: PrismaClient = prisma
) {
  const existing = await client.inboundApplication.findUnique({
    where: {
      mailboxId_uidValidity_uid: {
        mailboxId: input.mailboxId,
        uidValidity: input.uidValidity,
        uid: input.uid,
      },
    },
  });

  if (existing) {
    // If already terminal (matched or duplicate), do not re-claim
    if (existing.status === InboundStatus.MATCHED || existing.status === InboundStatus.DUPLICATE) {
      return { record: existing, claimed: false };
    }

    // Check if lease expired or status is retryable
    const now = Date.now();
    const isLeaseExpired =
      existing.status === InboundStatus.PROCESSING &&
      existing.lastAttemptAt &&
      now - existing.lastAttemptAt.getTime() > LEASE_TIMEOUT_MS;

    const canClaim =
      existing.status === InboundStatus.RECEIVED ||
      existing.status === InboundStatus.FAILED ||
      existing.status === InboundStatus.RETRYING ||
      isLeaseExpired;

    if (!canClaim) {
      return { record: existing, claimed: false };
    }

    // Claim lease atomically
    const claimCount = await client.inboundApplication.updateMany({
      where: {
        id: existing.id,
        OR: [
          { status: { in: [InboundStatus.RECEIVED, InboundStatus.FAILED, InboundStatus.RETRYING] } },
          {
            status: InboundStatus.PROCESSING,
            lastAttemptAt: { lt: new Date(now - LEASE_TIMEOUT_MS) },
          },
        ],
      },
      data: {
        status: InboundStatus.PROCESSING,
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    if (claimCount.count === 0) {
      return { record: existing, claimed: false };
    }

    const updated = await client.inboundApplication.findUnique({ where: { id: existing.id } });
    return { record: updated!, claimed: true };
  }

  // Brand new record
  const created = await client.inboundApplication.create({
    data: {
      mailboxId: input.mailboxId,
      uidValidity: input.uidValidity,
      uid: input.uid,
      messageId: input.messageId || null,
      subject: input.subject,
      senderEmail: input.senderEmail,
      senderName: input.senderName || null,
      recipientEmail: input.recipientEmail,
      receivedAt: input.receivedAt,
      status: InboundStatus.PROCESSING,
      attemptCount: 1,
      lastAttemptAt: new Date(),
      rawPayload: input.rawPayload || {},
    },
  });

  return { record: created, claimed: true };
}

/**
 * Core business engine: processes an inbound application email safely and idempotently.
 */
export async function processInboundEmail(
  recordId: string,
  rawEmail: Buffer | string,
  options?: { overrideJobId?: string },
  client: PrismaClient = prisma
): Promise<ProcessingResult> {
  const record = await client.inboundApplication.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error(`Inbound record ${recordId} not found`);
  }

  // If already matched or duplicate, return immediately
  if (record.status === InboundStatus.MATCHED || record.status === InboundStatus.DUPLICATE) {
    return {
      inboundId: record.id,
      status: record.status as InboundStatus,
      jobCode: record.extractedJobCode,
      matchedJobId: record.matchedJobId,
      matchedOrgId: record.matchedOrgId,
      candidateId: record.linkedCandidateId,
      applicationId: record.linkedApplicationId,
      isDuplicate: record.status === InboundStatus.DUPLICATE,
    };
  }

  // 1. Parse email
  let parsed: ParsedApplicationEmail;
  try {
    parsed = await parseApplicationEmail(rawEmail);
  } catch (parseErr: any) {
    logger.error({ err: parseErr, recordId }, 'Failed to parse incoming RFC822 email');
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        status: InboundStatus.FAILED,
        failureReason: INBOUND_FAILURE_REASONS.PARSE_FAILED,
        processedAt: new Date(),
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.FAILED,
      failureReason: INBOUND_FAILURE_REASONS.PARSE_FAILED,
    };
  }

  // 2. Resolve Job (by overrideJobId or extracted Job Code)
  let targetJob: any = null;

  if (options?.overrideJobId) {
    targetJob = await client.job.findUnique({
      where: { id: options.overrideJobId },
    });
    if (!targetJob) {
      await client.inboundApplication.update({
        where: { id: record.id },
        data: {
          status: InboundStatus.UNMATCHED,
          failureReason: INBOUND_FAILURE_REASONS.JOB_CODE_NOT_FOUND,
          processedAt: new Date(),
        },
      });
      return {
        inboundId: record.id,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.JOB_CODE_NOT_FOUND,
      };
    }
  } else {
    const { jobCode, isAmbiguous } = parsed.jobCodeResult;

    if (isAmbiguous) {
      await client.inboundApplication.update({
        where: { id: record.id },
        data: {
          status: InboundStatus.UNMATCHED,
          failureReason: INBOUND_FAILURE_REASONS.AMBIGUOUS_JOB_CODE,
          extractedJobCode: null,
          processedAt: new Date(),
          rawPayload: {
            candidatesFound: parsed.jobCodeResult.candidatesFound,
          },
        },
      });
      return {
        inboundId: record.id,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.AMBIGUOUS_JOB_CODE,
      };
    }

    if (!jobCode) {
      await client.inboundApplication.update({
        where: { id: record.id },
        data: {
          status: InboundStatus.UNMATCHED,
          failureReason: INBOUND_FAILURE_REASONS.NO_JOB_CODE,
          extractedJobCode: null,
          processedAt: new Date(),
        },
      });
      return {
        inboundId: record.id,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.NO_JOB_CODE,
      };
    }

    // Lookup job in DB by exact jobCode
    targetJob = await client.job.findUnique({
      where: { jobCode },
    });

    if (!targetJob) {
      await client.inboundApplication.update({
        where: { id: record.id },
        data: {
          extractedJobCode: jobCode,
          status: InboundStatus.UNMATCHED,
          failureReason: INBOUND_FAILURE_REASONS.JOB_CODE_NOT_FOUND,
          processedAt: new Date(),
        },
      });
      return {
        inboundId: record.id,
        status: InboundStatus.UNMATCHED,
        jobCode,
        failureReason: INBOUND_FAILURE_REASONS.JOB_CODE_NOT_FOUND,
      };
    }

    // Audit check: Detect discrepancy between subject job title and database job title
    // Preserves exact job-code matching while logging discrepancy for auditability
    if (parsed.subject && targetJob.title) {
      const subjectLower = parsed.subject.toLowerCase();
      const titleWords = targetJob.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
      const hasTitleOverlap = titleWords.some((w: string) => subjectLower.includes(w));
      if (!hasTitleOverlap) {
        logger.warn(
          {
            jobCode: targetJob.jobCode,
            databaseJobTitle: targetJob.title,
            emailSubject: parsed.subject,
            recordId: record.id,
          },
          'Notice: Email subject mentions a job title differing from database job record. Deterministic job-code matching was preserved.'
        );
      }
    }
  }

  // 3. Verify Job is accepting applications
  if (targetJob.status !== JobStatus.PUBLISHED) {
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: targetJob.organizationId,
        matchedClientId: targetJob.clientId,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.JOB_NOT_ACCEPTING_APPLICATIONS,
        processedAt: new Date(),
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.UNMATCHED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: targetJob.organizationId,
      failureReason: INBOUND_FAILURE_REASONS.JOB_NOT_ACCEPTING_APPLICATIONS,
    };
  }

  // 4. Derive Tenant from DB Job record
  const organizationId = targetJob.organizationId;
  const clientId = targetJob.clientId;

  // 5. Candidate details verification
  if (!parsed.candidateEmail) {
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        status: InboundStatus.FAILED,
        failureReason: INBOUND_FAILURE_REASONS.PARSE_FAILED_MISSING_EMAIL,
        processedAt: new Date(),
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.FAILED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      failureReason: INBOUND_FAILURE_REASONS.PARSE_FAILED_MISSING_EMAIL,
    };
  }

  const normalizedEmail = parsed.candidateEmail.trim().toLowerCase();
  const candidateName = parsed.candidateName || normalizedEmail.split('@')[0];

  // 6. Find or Create Candidate Scoped to Organization
  let candidate = await client.candidate.findUnique({
    where: {
      organizationId_normalizedEmail: {
        organizationId,
        normalizedEmail,
      },
    },
  });

  if (candidate) {
    // Update phone/location if missing on existing profile
    if ((parsed.candidatePhone && !candidate.phone) || (parsed.candidateLocation && !candidate.location)) {
      candidate = await client.candidate.update({
        where: { id: candidate.id },
        data: {
          phone: candidate.phone || parsed.candidatePhone,
          location: candidate.location || parsed.candidateLocation,
        },
      });
    }
  } else {
    const candidateCode = await allocateNextCandidateCode(client);
    try {
      candidate = await client.candidate.create({
        data: {
          organizationId,
          candidateCode,
          normalizedEmail,
          name: candidateName,
          phone: parsed.candidatePhone || null,
          location: parsed.candidateLocation || null,
        },
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        candidate = await client.candidate.findUnique({
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

  // 7. Duplicate Application Policy Check
  const existingApp = await client.application.findUnique({
    where: {
      jobId_candidateId: {
        jobId: targetJob.id,
        candidateId: candidate.id,
      },
    },
  });

  if (existingApp) {
    logger.info(
      { recordId: record.id, jobId: targetJob.id, candidateId: candidate.id, applicationId: existingApp.id },
      'Inbound application duplicate detected; marking duplicate without re-upload'
    );

    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        linkedCandidateId: candidate.id,
        linkedApplicationId: existingApp.id,
        status: InboundStatus.DUPLICATE,
        failureReason: 'duplicate_application',
        processedAt: new Date(),
      },
    });

    return {
      inboundId: record.id,
      status: InboundStatus.DUPLICATE,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      candidateId: candidate.id,
      applicationId: existingApp.id,
      isDuplicate: true,
      failureReason: 'duplicate_application',
    };
  }

  // 8. Validate Resume Attachment
  if (!parsed.resumeAttachment) {
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        linkedCandidateId: candidate.id,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.RESUME_MISSING,
        processedAt: new Date(),
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.UNMATCHED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      candidateId: candidate.id,
      failureReason: INBOUND_FAILURE_REASONS.RESUME_MISSING,
    };
  }

  const validation = validateAttachment(parsed.resumeAttachment);
  if (!validation.isValid) {
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        linkedCandidateId: candidate.id,
        status: InboundStatus.UNMATCHED,
        failureReason: INBOUND_FAILURE_REASONS.RESUME_INVALID,
        processedAt: new Date(),
        rawPayload: {
          validationError: validation.error,
        },
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.UNMATCHED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      candidateId: candidate.id,
      failureReason: INBOUND_FAILURE_REASONS.RESUME_INVALID,
    };
  }

  // 9. Upload Resume to Supabase Storage
  let uploadResult: {
    storagePath: string;
    safeFilename: string;
    checksum: string;
    fileSize: number;
  };

  try {
    uploadResult = await WorkerStorageService.uploadResume({
      organizationId,
      candidateId: candidate.id,
      buffer: parsed.resumeAttachment.buffer,
      extension: validation.extension,
      contentType: validation.mimeType,
    });
  } catch (storageErr: any) {
    logger.error({ err: storageErr, recordId: record.id }, 'Storage upload failed during inbound processing');
    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        linkedCandidateId: candidate.id,
        status: InboundStatus.FAILED,
        failureReason: INBOUND_FAILURE_REASONS.STORAGE_FAILED,
        processedAt: new Date(),
      },
    });
    return {
      inboundId: record.id,
      status: InboundStatus.FAILED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      candidateId: candidate.id,
      failureReason: INBOUND_FAILURE_REASONS.STORAGE_FAILED,
    };
  }

  // 10. Persist Relational Records in Database Transaction
  try {
    const finalApp = await client.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          organizationId,
          clientId,
          jobId: targetJob.id,
          candidateId: candidate.id,
          stage: 'Applied',
          source: 'PyjamaHR email',
          status: 'active',
          answers: {
            inboundMailboxId: record.mailboxId,
            messageId: parsed.messageId,
          },
        },
      });

      await tx.resume.create({
        data: {
          candidateId: candidate.id,
          applicationId: app.id,
          bucket: WorkerStorageService.BUCKET,
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
          reason: 'Application ingested via PyjamaHR inbound email',
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId,
          entityType: 'application',
          entityId: app.id,
          action: 'inbound_email_matched',
          details: {
            jobCode: targetJob.jobCode,
            messageId: parsed.messageId,
            mailboxId: record.mailboxId,
            inboundApplicationId: record.id,
          },
        },
      });

      await tx.inboundApplication.update({
        where: { id: record.id },
        data: {
          extractedJobCode: targetJob.jobCode,
          matchedJobId: targetJob.id,
          matchedOrgId: organizationId,
          matchedClientId: clientId,
          linkedCandidateId: candidate.id,
          linkedApplicationId: app.id,
          status: InboundStatus.MATCHED,
          processedAt: new Date(),
          failureReason: null,
        },
      });

      return app;
    }, { timeout: 35000, maxWait: 15000 });

    return {
      inboundId: record.id,
      status: InboundStatus.MATCHED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      candidateId: candidate.id,
      applicationId: finalApp.id,
    };
  } catch (dbError: any) {
    // 11. Compensating cleanup: remove uploaded file from storage
    logger.error({ err: dbError, storagePath: uploadResult.storagePath }, 'Database transaction failed; removing uploaded resume');
    await WorkerStorageService.deleteResume(uploadResult.storagePath).catch((cleanErr) => {
      logger.error({ err: cleanErr }, 'Failed to delete resume during compensating cleanup');
    });

    await client.inboundApplication.update({
      where: { id: record.id },
      data: {
        extractedJobCode: targetJob.jobCode,
        matchedJobId: targetJob.id,
        matchedOrgId: organizationId,
        matchedClientId: clientId,
        status: InboundStatus.FAILED,
        failureReason: INBOUND_FAILURE_REASONS.DATABASE_FAILED,
        processedAt: new Date(),
      },
    });

    return {
      inboundId: record.id,
      status: InboundStatus.FAILED,
      jobCode: targetJob.jobCode,
      matchedJobId: targetJob.id,
      matchedOrgId: organizationId,
      failureReason: INBOUND_FAILURE_REASONS.DATABASE_FAILED,
    };
  }
}

/**
 * Platform Administrator manual assignment of an unmatched inbound email to a specific job.
 */
export async function manualAssignInboundRecord(
  inboundId: string,
  targetJobId: string,
  rawEmailFallback?: Buffer | string,
  client: PrismaClient = prisma
): Promise<ProcessingResult> {
  const record = await client.inboundApplication.findUnique({
    where: { id: inboundId },
  });

  if (!record) {
    const err = new Error('Inbound application not found');
    (err as any).statusCode = 404;
    throw err;
  }

  // Re-run processInboundEmail with overrideJobId
  // If rawEmail is not provided, we use minimal synthetic email representation reconstructed from rawPayload/metadata
  let rawEmail = rawEmailFallback;
  if (!rawEmail) {
    rawEmail = Buffer.from(
      `Subject: ${record.subject}\r\nFrom: ${record.senderEmail}\r\nTo: ${record.recipientEmail}\r\n\r\n`
    );
  }

  return processInboundEmail(record.id, rawEmail, { overrideJobId: targetJobId }, client);
}
