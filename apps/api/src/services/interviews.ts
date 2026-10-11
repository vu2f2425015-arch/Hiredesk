import { prisma } from '@hiredesk/database';
import {
  UserRole,
  InterviewStatus,
  InterviewType,
  InterviewRequestStatus,
  CommunicationStatus,
  CommunicationTemplateId,
  ScheduleInterviewInput,
  RescheduleInterviewInput,
  CancelInterviewInput,
  CompleteInterviewInput,
  RecordNoShowInput,
  UpdateFeedbackInput,
  InterviewQueryInput,
  InterviewDto,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { generateIcsCalendar } from './calendar.js';
import {
  renderCandidateInvitation,
  renderClientInterviewNotice,
  renderInterviewRescheduled,
  renderInterviewCancelled,
} from './emailTemplates.js';
import { EmailService } from './email.js';
import { logger } from '../utils/logger.js';

export class InterviewService {
  /**
   * Helper to ensure caller belongs to an active organization
   */
  private static requireOrgId(user: AuthenticatedUser): string {
    if (!user.organizationId) {
      const err = new Error('User has no assigned organization');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
    return user.organizationId;
  }

  /**
   * Helper to assert recruiter/manager/super_admin role
   */
  private static requireRecruiterRole(user: AuthenticatedUser): void {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Interview management restricted to agency recruiters and managers');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }
  }

  /**
   * List interviews scoped by organization with optional filters
   */
  static async listInterviews(
    user: AuthenticatedUser,
    query: InterviewQueryInput
  ): Promise<{ interviews: InterviewDto[]; total: number; page: number; limit: number }> {
    const orgId = this.requireOrgId(user);
    const isClient = user.role === UserRole.CLIENT;

    const where: any = {
      organizationId: orgId,
    };

    if (isClient) {
      if (!user.clientId) {
        const err = new Error('Client user has no assigned client');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
      where.clientId = user.clientId;
    } else if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.jobId) {
      where.jobId = query.jobId;
    }

    if (query.candidateId) {
      where.candidateId = query.candidateId;
    }

    if (query.interviewerId) {
      where.interviewerUserProfileId = query.interviewerId;
    }

    if (query.startDate || query.endDate) {
      where.startAt = {};
      if (query.startDate) {
        where.startAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.startAt.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      const q = query.search.trim();
      where.OR = [
        { candidate: { name: { contains: q, mode: 'insensitive' } } },
        { candidate: { candidateCode: { contains: q, mode: 'insensitive' } } },
        { job: { title: { contains: q, mode: 'insensitive' } } },
        { job: { jobCode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
        include: {
          candidate: {
            select: { id: true, name: true, normalizedEmail: true, candidateCode: true },
          },
          job: {
            select: { id: true, jobCode: true, title: true },
          },
          client: {
            select: { id: true, name: true },
          },
          interviewer: {
            select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
          },
          scheduledBy: {
            select: { id: true, fullName: true, firstName: true, lastName: true },
          },
          communications: {
            select: {
              id: true,
              recipientEmail: true,
              recipientName: true,
              recipientType: true,
              templateId: true,
              subject: true,
              status: true,
              providerMessageId: true,
              attemptCount: true,
              lastAttemptAt: true,
              sentAt: true,
              failedAt: true,
              errorCode: true,
              errorMessage: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          histories: {
            select: {
              id: true,
              previousStatus: true,
              nextStatus: true,
              startAt: true,
              endAt: true,
              timeZone: true,
              reason: true,
              notes: true,
              createdAt: true,
              actor: {
                select: { id: true, fullName: true, firstName: true, lastName: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.interview.count({ where }),
    ]);

    const formatted: InterviewDto[] = records.map((r: any) => ({
      id: r.id,
      organizationId: r.organizationId,
      clientId: r.clientId,
      jobId: r.jobId,
      applicationId: r.applicationId,
      candidateId: r.candidateId,
      interviewerUserProfileId: r.interviewerUserProfileId,
      scheduledByUserProfileId: r.scheduledByUserProfileId,
      type: r.type,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      timeZone: r.timeZone,
      meetingProvider: r.meetingProvider,
      meetingUrl: r.meetingUrl,
      location: r.location,
      sequence: r.sequence,
      interviewerNotes: isClient ? undefined : r.interviewerNotes,
      feedback: r.feedback,
      result: r.result,
      cancellationReason: r.cancellationReason,
      candidate: r.candidate,
      job: r.job,
      client: r.client,
      interviewer: r.interviewer,
      scheduledBy: r.scheduledBy,
      communications: isClient
        ? []
        : r.communications?.map((c: any) => ({
            ...c,
            lastAttemptAt: c.lastAttemptAt?.toISOString() || null,
            sentAt: c.sentAt?.toISOString() || null,
            failedAt: c.failedAt?.toISOString() || null,
            createdAt: c.createdAt.toISOString(),
          })),
      histories: r.histories?.map((h: any) => ({
        ...h,
        startAt: h.startAt.toISOString(),
        endAt: h.endAt.toISOString(),
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return { interviews: formatted, total, page, limit };
  }

  /**
   * Get single interview details with tenant checks and role redaction
   */
  static async getInterview(user: AuthenticatedUser, id: string): Promise<InterviewDto> {
    const orgId = this.requireOrgId(user);
    const isClient = user.role === UserRole.CLIENT;

    const interview = await prisma.interview.findFirst({
      where: {
        id,
        organizationId: orgId,
        ...(isClient ? { clientId: user.clientId! } : {}),
      },
      include: {
        candidate: {
          select: { id: true, name: true, normalizedEmail: true, candidateCode: true },
        },
        job: {
          select: { id: true, jobCode: true, title: true },
        },
        client: {
          select: { id: true, name: true },
        },
        interviewer: {
          select: { id: true, fullName: true, firstName: true, lastName: true, email: true },
        },
        scheduledBy: {
          select: { id: true, fullName: true, firstName: true, lastName: true },
        },
        communications: {
          select: {
            id: true,
            recipientEmail: true,
            recipientName: true,
            recipientType: true,
            templateId: true,
            subject: true,
            status: true,
            providerMessageId: true,
            attemptCount: true,
            lastAttemptAt: true,
            sentAt: true,
            failedAt: true,
            errorCode: true,
            errorMessage: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        histories: {
          select: {
            id: true,
            previousStatus: true,
            nextStatus: true,
            startAt: true,
            endAt: true,
            timeZone: true,
            reason: true,
            notes: true,
            createdAt: true,
            actor: {
              select: { id: true, fullName: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
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
      organizationId: interview.organizationId,
      clientId: interview.clientId,
      jobId: interview.jobId,
      applicationId: interview.applicationId,
      candidateId: interview.candidateId,
      interviewerUserProfileId: interview.interviewerUserProfileId,
      scheduledByUserProfileId: interview.scheduledByUserProfileId,
      type: interview.type,
      status: interview.status,
      startAt: interview.startAt.toISOString(),
      endAt: interview.endAt.toISOString(),
      timeZone: interview.timeZone,
      meetingProvider: interview.meetingProvider,
      meetingUrl: interview.meetingUrl,
      location: interview.location,
      sequence: interview.sequence,
      interviewerNotes: isClient ? undefined : interview.interviewerNotes,
      feedback: interview.feedback,
      result: interview.result,
      cancellationReason: interview.cancellationReason,
      candidate: interview.candidate,
      job: interview.job,
      client: interview.client,
      interviewer: interview.interviewer,
      scheduledBy: interview.scheduledBy,
      communications: isClient
        ? []
        : interview.communications?.map((c: any) => ({
            ...c,
            lastAttemptAt: c.lastAttemptAt?.toISOString() || null,
            sentAt: c.sentAt?.toISOString() || null,
            failedAt: c.failedAt?.toISOString() || null,
            createdAt: c.createdAt.toISOString(),
          })),
      histories: interview.histories?.map((h: any) => ({
        ...h,
        startAt: h.startAt.toISOString(),
        endAt: h.endAt.toISOString(),
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: interview.createdAt.toISOString(),
      updatedAt: interview.updatedAt.toISOString(),
    };
  }

  /**
   * Schedule an interview from an application or pending InterviewRequest
   */
  static async scheduleInterview(
    user: AuthenticatedUser,
    input: ScheduleInterviewInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (endAt.getTime() <= startAt.getTime()) {
      const err = new Error('End time must be after start time');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_TIME_RANGE';
      throw err;
    }

    // 1. Verify Application exists and matches organization
    const application = await prisma.application.findFirst({
      where: {
        id: input.applicationId,
        organizationId: orgId,
      },
      include: {
        candidate: true,
        job: true,
        client: true,
      },
    });

    if (!application) {
      const err = new Error('Application not found within caller organization');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Verify consistency across provided IDs
    if (application.candidateId !== input.candidateId) {
      const err = new Error('Specified candidate does not match application');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_RELATION';
      throw err;
    }

    if (application.jobId !== input.jobId) {
      const err = new Error('Specified job does not match application');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_RELATION';
      throw err;
    }

    if (application.clientId !== input.clientId) {
      const err = new Error('Specified client does not match application');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_RELATION';
      throw err;
    }

    // 2. Verify interviewer exists in same organization
    const interviewer = await prisma.userProfile.findFirst({
      where: {
        id: input.interviewerUserProfileId,
        organizationId: orgId,
        isActive: true,
      },
    });

    if (!interviewer) {
      const err = new Error('Interviewer not found or inactive in caller organization');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_INTERVIEWER';
      throw err;
    }

    // 3. Concurrency check: verify interviewer does not have overlapping active interviews
    const conflict = await prisma.interview.findFirst({
      where: {
        organizationId: orgId,
        interviewerUserProfileId: input.interviewerUserProfileId,
        status: { in: [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) {
      const err = new Error(
        `Interviewer already has an active interview scheduled between ${conflict.startAt.toISOString()} and ${conflict.endAt.toISOString()}`
      );
      (err as any).statusCode = 409;
      (err as any).code = 'INTERVIEWER_CONFLICT';
      throw err;
    }

    // 4. If scheduled from pending InterviewRequest, verify and lock it
    let pendingRequest: any = null;
    if (input.interviewRequestId) {
      pendingRequest = await prisma.interviewRequest.findFirst({
        where: {
          id: input.interviewRequestId,
          organizationId: orgId,
          applicationId: input.applicationId,
        },
      });

      if (!pendingRequest) {
        const err = new Error('Interview request not found for this application');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }

      if (pendingRequest.status !== InterviewRequestStatus.PENDING) {
        const err = new Error(`Interview request is already ${pendingRequest.status}`);
        (err as any).statusCode = 400;
        (err as any).code = 'INVALID_STATE';
        throw err;
      }
    }

    // 5. Generate .ics attachment content
    const icsContent = generateIcsCalendar({
      interviewId: 'pending', // replaced below
      sequence: 0,
      summary: `Interview: ${application.job.title} (${application.job.jobCode})`,
      description: `Interview for ${application.candidate.name} with ${application.client.name}.\nMode: ${input.type}\nTime Zone: ${input.timeZone}`,
      startAt,
      endAt,
      location: input.location,
      url: input.meetingUrl,
      organizerName: interviewer.fullName || `${interviewer.firstName} ${interviewer.lastName}`,
      organizerEmail: interviewer.email,
      attendeeName: application.candidate.name,
      attendeeEmail: application.candidate.normalizedEmail,
      isCancellation: false,
    });

    // 6. Execute atomic PostgreSQL transaction
    const createdInterview = await prisma.$transaction(async (tx: any) => {
      // Create Interview
      const newInterview = await tx.interview.create({
        data: {
          organizationId: orgId,
          clientId: application.clientId,
          jobId: application.jobId,
          applicationId: application.id,
          candidateId: application.candidateId,
          interviewerUserProfileId: input.interviewerUserProfileId,
          scheduledByUserProfileId: user.id,
          type: input.type,
          status: InterviewStatus.SCHEDULED,
          startAt,
          endAt,
          timeZone: input.timeZone,
          meetingProvider: input.meetingProvider || null,
          meetingUrl: input.meetingUrl || null,
          location: input.location || null,
          sequence: 0,
          interviewerNotes: input.interviewerNotes || null,
        },
      });

      // Create initial history record
      await tx.interviewHistory.create({
        data: {
          interviewId: newInterview.id,
          actorId: user.id,
          previousStatus: 'none',
          nextStatus: InterviewStatus.SCHEDULED,
          startAt,
          endAt,
          timeZone: input.timeZone,
          reason: 'Initial interview schedule',
          notes: input.interviewerNotes || null,
        },
      });

      // If pending InterviewRequest was provided, link it and update status
      if (pendingRequest) {
        await tx.interviewRequest.update({
          where: { id: pendingRequest.id },
          data: {
            status: InterviewRequestStatus.SCHEDULED,
            interviewId: newInterview.id,
          },
        });
      }

      // Record ActivityLog
      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          entityType: 'Interview',
          entityId: newInterview.id,
          action: 'interview_scheduled',
          details: {
            candidateName: application.candidate.name,
            jobTitle: application.job.title,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            timeZone: input.timeZone,
            type: input.type,
          },
          visibility: 'client_visible',
        },
      });

      // Prepare updated .ics with real ID
      const realIcsContent = icsContent.replace('interview-pending@', `interview-${newInterview.id}@`);

      // Prepare email templates
      const emailParams = {
        candidateName: application.candidate.name,
        candidateEmail: application.candidate.normalizedEmail,
        jobTitle: application.job.title,
        jobCode: application.job.jobCode,
        clientName: application.client.name,
        interviewerName: interviewer.fullName || `${interviewer.firstName} ${interviewer.lastName}`,
        interviewerEmail: interviewer.email,
        interviewType: input.type,
        startAt,
        endAt,
        timeZone: input.timeZone,
        meetingUrl: input.meetingUrl,
        location: input.location,
      };

      const candidateEmail = renderCandidateInvitation(emailParams);

      // 1. Outbox entry for Candidate
      const candComm = await tx.outboundCommunication.create({
        data: {
          organizationId: orgId,
          candidateId: application.candidateId,
          applicationId: application.id,
          jobId: application.jobId,
          interviewId: newInterview.id,
          recipientEmail: application.candidate.normalizedEmail,
          recipientName: application.candidate.name,
          recipientType: 'candidate',
          templateId: CommunicationTemplateId.INTERVIEW_INVITATION,
          subject: candidateEmail.subject,
          bodyText: candidateEmail.text,
          bodyHtml: candidateEmail.html,
          status: CommunicationStatus.QUEUED,
          idempotencyKey: `interview-${newInterview.id}-invitation-cand-${application.candidateId}-seq0`,
          metadata: {
            icsContent: realIcsContent,
            isCancellation: false,
          },
        },
      });

      // 2. Outbox entry for Client contact email
      let clientComm: any = null;
      if (application.client.contactEmail) {
        const clientEmail = renderClientInterviewNotice(emailParams);
        clientComm = await tx.outboundCommunication.create({
          data: {
            organizationId: orgId,
            candidateId: application.candidateId,
            applicationId: application.id,
            jobId: application.jobId,
            interviewId: newInterview.id,
            recipientEmail: application.client.contactEmail,
            recipientName: application.client.name,
            recipientType: 'client',
            templateId: CommunicationTemplateId.INTERVIEW_CLIENT_NOTICE,
            subject: clientEmail.subject,
            bodyText: clientEmail.text,
            bodyHtml: clientEmail.html,
            status: CommunicationStatus.QUEUED,
            idempotencyKey: `interview-${newInterview.id}-notice-client-${application.client.id}-seq0`,
            metadata: {
              isCancellation: false,
            },
          },
        });
      }

      return { newInterview, candCommId: candComm.id, clientCommId: clientComm?.id };
    });

    // Trigger immediate outbox delivery in background (best-effort)
    setImmediate(async () => {
      try {
        if (createdInterview.candCommId) {
          await EmailService.processCommunicationRecord(createdInterview.candCommId);
        }
        if (createdInterview.clientCommId) {
          await EmailService.processCommunicationRecord(createdInterview.clientCommId);
        }
      } catch (err) {
        logger.error({ err }, 'Background email delivery dispatch error');
      }
    });

    return this.getInterview(user, createdInterview.newInterview.id);
  }

  /**
   * Reschedule an existing interview
   */
  static async rescheduleInterview(
    user: AuthenticatedUser,
    id: string,
    input: RescheduleInterviewInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const interview = await prisma.interview.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      include: {
        candidate: true,
        job: true,
        client: true,
        interviewer: true,
      },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (interview.status === InterviewStatus.COMPLETED || interview.status === InterviewStatus.CANCELLED) {
      const err = new Error(`Cannot reschedule an interview that is ${interview.status}`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_STATE';
      throw err;
    }

    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);

    if (endAt.getTime() <= startAt.getTime()) {
      const err = new Error('End time must be after start time');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_TIME_RANGE';
      throw err;
    }

    // Check conflict for interviewer, excluding this interview
    const conflict = await prisma.interview.findFirst({
      where: {
        id: { not: interview.id },
        organizationId: orgId,
        interviewerUserProfileId: interview.interviewerUserProfileId,
        status: { in: [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (conflict) {
      const err = new Error(
        `Interviewer already has an active interview scheduled between ${conflict.startAt.toISOString()} and ${conflict.endAt.toISOString()}`
      );
      (err as any).statusCode = 409;
      (err as any).code = 'INTERVIEWER_CONFLICT';
      throw err;
    }

    const newSequence = interview.sequence + 1;

    // Generate updated .ics
    const icsContent = generateIcsCalendar({
      interviewId: interview.id,
      sequence: newSequence,
      summary: `Rescheduled Interview: ${interview.job.title} (${interview.job.jobCode})`,
      description: `Rescheduled interview for ${interview.candidate.name}.\nMode: ${interview.type}\nReason: ${input.reason || 'Schedule update'}`,
      startAt,
      endAt,
      location: input.location !== undefined ? input.location : interview.location,
      url: input.meetingUrl !== undefined ? input.meetingUrl : interview.meetingUrl,
      organizerName: interview.interviewer.fullName || `${interview.interviewer.firstName} ${interview.interviewer.lastName}`,
      organizerEmail: interview.interviewer.email,
      attendeeName: interview.candidate.name,
      attendeeEmail: interview.candidate.normalizedEmail,
      isCancellation: false,
    });

    const updatedData = await prisma.$transaction(async (tx: any) => {
      // 1. Update Interview record
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          startAt,
          endAt,
          timeZone: input.timeZone,
          meetingProvider: input.meetingProvider !== undefined ? input.meetingProvider : interview.meetingProvider,
          meetingUrl: input.meetingUrl !== undefined ? input.meetingUrl : interview.meetingUrl,
          location: input.location !== undefined ? input.location : interview.location,
          sequence: newSequence,
          status: InterviewStatus.RESCHEDULED,
          interviewerNotes: input.interviewerNotes !== undefined ? input.interviewerNotes : interview.interviewerNotes,
        },
      });

      // 2. Add history record
      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          actorId: user.id,
          previousStatus: interview.status,
          nextStatus: InterviewStatus.RESCHEDULED,
          startAt,
          endAt,
          timeZone: input.timeZone,
          reason: input.reason || 'Rescheduled by recruiter',
          notes: input.interviewerNotes || null,
        },
      });

      // 3. ActivityLog
      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          entityType: 'Interview',
          entityId: interview.id,
          action: 'interview_rescheduled',
          details: {
            candidateName: interview.candidate.name,
            jobTitle: interview.job.title,
            newStartAt: startAt.toISOString(),
            newEndAt: endAt.toISOString(),
            reason: input.reason || null,
          },
          visibility: 'client_visible',
        },
      });

      // 4. Render Rescheduled Email
      const emailParams = {
        candidateName: interview.candidate.name,
        candidateEmail: interview.candidate.normalizedEmail,
        jobTitle: interview.job.title,
        jobCode: interview.job.jobCode,
        clientName: interview.client.name,
        interviewerName: interview.interviewer.fullName || `${interview.interviewer.firstName} ${interview.interviewer.lastName}`,
        interviewerEmail: interview.interviewer.email,
        interviewType: interview.type,
        startAt,
        endAt,
        timeZone: input.timeZone,
        meetingUrl: input.meetingUrl !== undefined ? input.meetingUrl : interview.meetingUrl,
        location: input.location !== undefined ? input.location : interview.location,
        reason: input.reason,
      };

      const rescheduleEmail = renderInterviewRescheduled(emailParams);

      const comm = await tx.outboundCommunication.create({
        data: {
          organizationId: orgId,
          candidateId: interview.candidateId,
          applicationId: interview.applicationId,
          jobId: interview.jobId,
          interviewId: interview.id,
          recipientEmail: interview.candidate.normalizedEmail,
          recipientName: interview.candidate.name,
          recipientType: 'candidate',
          templateId: CommunicationTemplateId.INTERVIEW_RESCHEDULED,
          subject: rescheduleEmail.subject,
          bodyText: rescheduleEmail.text,
          bodyHtml: rescheduleEmail.html,
          status: CommunicationStatus.QUEUED,
          idempotencyKey: `interview-${interview.id}-reschedule-cand-seq${newSequence}`,
          metadata: {
            icsContent,
            isCancellation: false,
          },
        },
      });

      return { commId: comm.id };
    });

    setImmediate(async () => {
      try {
        if (updatedData.commId) {
          await EmailService.processCommunicationRecord(updatedData.commId);
        }
      } catch (err) {
        logger.error({ err }, 'Background reschedule email dispatch error');
      }
    });

    return this.getInterview(user, interview.id);
  }

  /**
   * Cancel an interview
   */
  static async cancelInterview(
    user: AuthenticatedUser,
    id: string,
    input: CancelInterviewInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const interview = await prisma.interview.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      include: {
        candidate: true,
        job: true,
        client: true,
        interviewer: true,
      },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (interview.status === InterviewStatus.CANCELLED) {
      const err = new Error('Interview is already cancelled');
      (err as any).statusCode = 400;
      (err as any).code = 'ALREADY_CANCELLED';
      throw err;
    }

    const cancelSequence = interview.sequence + 1;

    // Generate cancellation .ics
    const icsContent = generateIcsCalendar({
      interviewId: interview.id,
      sequence: cancelSequence,
      summary: `Cancelled Interview: ${interview.job.title} (${interview.job.jobCode})`,
      description: `Interview cancelled.\nReason: ${input.reason}`,
      startAt: interview.startAt,
      endAt: interview.endAt,
      organizerName: interview.interviewer.fullName || `${interview.interviewer.firstName} ${interview.interviewer.lastName}`,
      organizerEmail: interview.interviewer.email,
      attendeeName: interview.candidate.name,
      attendeeEmail: interview.candidate.normalizedEmail,
      isCancellation: true,
    });

    const updatedData = await prisma.$transaction(async (tx: any) => {
      // 1. Update Interview record
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          status: InterviewStatus.CANCELLED,
          cancellationReason: input.reason,
          sequence: cancelSequence,
        },
      });

      // 2. Add history record
      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          actorId: user.id,
          previousStatus: interview.status,
          nextStatus: InterviewStatus.CANCELLED,
          startAt: interview.startAt,
          endAt: interview.endAt,
          timeZone: interview.timeZone,
          reason: input.reason,
        },
      });

      // 3. ActivityLog
      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          entityType: 'Interview',
          entityId: interview.id,
          action: 'interview_cancelled',
          details: {
            candidateName: interview.candidate.name,
            jobTitle: interview.job.title,
            reason: input.reason,
          },
          visibility: 'client_visible',
        },
      });

      // 4. Render Cancellation Email
      const emailParams = {
        candidateName: interview.candidate.name,
        candidateEmail: interview.candidate.normalizedEmail,
        jobTitle: interview.job.title,
        jobCode: interview.job.jobCode,
        clientName: interview.client.name,
        interviewerName: interview.interviewer.fullName || `${interview.interviewer.firstName} ${interview.interviewer.lastName}`,
        interviewerEmail: interview.interviewer.email,
        interviewType: interview.type,
        startAt: interview.startAt,
        endAt: interview.endAt,
        timeZone: interview.timeZone,
        reason: input.reason,
      };

      const cancelEmail = renderInterviewCancelled(emailParams);

      const comm = await tx.outboundCommunication.create({
        data: {
          organizationId: orgId,
          candidateId: interview.candidateId,
          applicationId: interview.applicationId,
          jobId: interview.jobId,
          interviewId: interview.id,
          recipientEmail: interview.candidate.normalizedEmail,
          recipientName: interview.candidate.name,
          recipientType: 'candidate',
          templateId: CommunicationTemplateId.INTERVIEW_CANCELLED,
          subject: cancelEmail.subject,
          bodyText: cancelEmail.text,
          bodyHtml: cancelEmail.html,
          status: CommunicationStatus.QUEUED,
          idempotencyKey: `interview-${interview.id}-cancel-cand-seq${cancelSequence}`,
          metadata: {
            icsContent,
            isCancellation: true,
          },
        },
      });

      return { commId: comm.id };
    });

    setImmediate(async () => {
      try {
        if (updatedData.commId) {
          await EmailService.processCommunicationRecord(updatedData.commId);
        }
      } catch (err) {
        logger.error({ err }, 'Background cancellation email dispatch error');
      }
    });

    return this.getInterview(user, interview.id);
  }

  /**
   * Mark an interview as completed with feedback and result
   */
  static async completeInterview(
    user: AuthenticatedUser,
    id: string,
    input: CompleteInterviewInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const interview = await prisma.interview.findFirst({
      where: { id, organizationId: orgId },
      include: { candidate: true, job: true },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (interview.status !== InterviewStatus.SCHEDULED && interview.status !== InterviewStatus.RESCHEDULED) {
      const err = new Error(`Cannot complete an interview with status ${interview.status}`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_STATE';
      throw err;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          status: InterviewStatus.COMPLETED,
          feedback: input.feedback || interview.feedback,
          result: input.result || interview.result,
          interviewerNotes: input.interviewerNotes || interview.interviewerNotes,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          actorId: user.id,
          previousStatus: interview.status,
          nextStatus: InterviewStatus.COMPLETED,
          startAt: interview.startAt,
          endAt: interview.endAt,
          timeZone: interview.timeZone,
          reason: 'Marked completed by recruiter',
          notes: input.feedback || null,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          entityType: 'Interview',
          entityId: interview.id,
          action: 'interview_completed',
          details: {
            candidateName: interview.candidate.name,
            jobTitle: interview.job.title,
            result: input.result || 'pending',
          },
          visibility: 'client_visible',
        },
      });
    });

    return this.getInterview(user, interview.id);
  }

  /**
   * Mark an interview as no-show
   */
  static async recordNoShow(
    user: AuthenticatedUser,
    id: string,
    input: RecordNoShowInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const interview = await prisma.interview.findFirst({
      where: { id, organizationId: orgId },
      include: { candidate: true, job: true },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    if (interview.status !== InterviewStatus.SCHEDULED && interview.status !== InterviewStatus.RESCHEDULED) {
      const err = new Error(`Cannot mark no-show for an interview with status ${interview.status}`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_STATE';
      throw err;
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.interview.update({
        where: { id: interview.id },
        data: {
          status: InterviewStatus.NO_SHOW,
          interviewerNotes: input.notes
            ? `${interview.interviewerNotes ? `${interview.interviewerNotes}\n` : ''}[No-Show]: ${input.notes}`
            : interview.interviewerNotes,
        },
      });

      await tx.interviewHistory.create({
        data: {
          interviewId: interview.id,
          actorId: user.id,
          previousStatus: interview.status,
          nextStatus: InterviewStatus.NO_SHOW,
          startAt: interview.startAt,
          endAt: interview.endAt,
          timeZone: interview.timeZone,
          reason: 'Candidate did not attend interview',
          notes: input.notes || null,
        },
      });

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          actorId: user.id,
          entityType: 'Interview',
          entityId: interview.id,
          action: 'interview_no_show',
          details: {
            candidateName: interview.candidate.name,
            jobTitle: interview.job.title,
          },
          visibility: 'internal',
        },
      });
    });

    return this.getInterview(user, interview.id);
  }

  /**
   * Record or update feedback & result
   */
  static async updateFeedback(
    user: AuthenticatedUser,
    id: string,
    input: UpdateFeedbackInput
  ): Promise<InterviewDto> {
    this.requireRecruiterRole(user);
    const orgId = this.requireOrgId(user);

    const interview = await prisma.interview.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!interview) {
      const err = new Error('Interview not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    await prisma.interview.update({
      where: { id },
      data: {
        feedback: input.feedback,
        result: input.result || interview.result,
      },
    });

    await prisma.activityLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        entityType: 'Interview',
        entityId: interview.id,
        action: 'interview_feedback_updated',
        details: { result: input.result || interview.result },
        visibility: 'client_visible',
      },
    });

    return this.getInterview(user, id);
  }

  /**
   * Generate downloadable .ics iCalendar content for an interview
   */
  static async getIcsCalendar(user: AuthenticatedUser, id: string): Promise<string> {
    const interview = await this.getInterview(user, id);

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
      organizerEmail: interview.interviewer.email,
      attendeeName: interview.candidate.name,
      attendeeEmail: interview.candidate.normalizedEmail,
      isCancellation: interview.status === InterviewStatus.CANCELLED,
    });
  }
}
