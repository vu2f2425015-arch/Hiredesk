import { z } from 'zod';
import {
  InterviewType,
  InterviewStatus,
  MeetingProvider,
  CommunicationStatus,
  CommunicationTemplateId,
} from '../enums.js';

// Helper to validate IANA timezone identifiers
export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const ScheduleInterviewSchema = z
  .object({
    applicationId: z.string().min(1, 'Valid application ID is required'),
    jobId: z.string().min(1, 'Valid job ID is required'),
    candidateId: z.string().min(1, 'Valid candidate ID is required'),
    clientId: z.string().min(1, 'Valid client ID is required'),
    interviewerUserProfileId: z.string().min(1, 'Valid interviewer profile ID is required'),
    interviewRequestId: z.string().min(1).optional().nullable(),
    type: z.nativeEnum(InterviewType).default(InterviewType.VIDEO),

    startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 datetime' }),
    endAt: z.string().datetime({ message: 'endAt must be a valid ISO 8601 datetime' }),
    timeZone: z
      .string()
      .min(1, 'timeZone is required')
      .default('UTC')
      .refine((tz) => isValidTimeZone(tz), {
        message: 'Invalid IANA timezone identifier (e.g. UTC, Asia/Kolkata, America/New_York)',
      }),
    meetingProvider: z.nativeEnum(MeetingProvider).optional().nullable(),
    meetingUrl: z
      .string()
      .url('meetingUrl must be a valid URL')
      .max(1000)
      .optional()
      .nullable()
      .or(z.literal('')),
    location: z.string().max(255).optional().nullable(),
    interviewerNotes: z.string().max(5000).optional().nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      return end > start;
    },
    {
      message: 'Interview end time must be strictly after start time',
      path: ['endAt'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      // Minimum 10 minutes duration
      return end - start >= 10 * 60 * 1000;
    },
    {
      message: 'Interview duration must be at least 10 minutes',
      path: ['endAt'],
    }
  );

export type ScheduleInterviewInput = z.infer<typeof ScheduleInterviewSchema>;

export const RescheduleInterviewSchema = z
  .object({
    startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 datetime' }),
    endAt: z.string().datetime({ message: 'endAt must be a valid ISO 8601 datetime' }),
    timeZone: z
      .string()
      .min(1)
      .default('UTC')
      .refine((tz) => isValidTimeZone(tz), {
        message: 'Invalid IANA timezone identifier',
      }),
    meetingProvider: z.nativeEnum(MeetingProvider).optional().nullable(),
    meetingUrl: z
      .string()
      .url('meetingUrl must be a valid URL')
      .max(1000)
      .optional()
      .nullable()
      .or(z.literal('')),
    location: z.string().max(255).optional().nullable(),
    reason: z.string().max(1000).optional().nullable(),
    interviewerNotes: z.string().max(5000).optional().nullable(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      return end > start;
    },
    {
      message: 'Interview end time must be strictly after start time',
      path: ['endAt'],
    }
  )
  .refine(
    (data) => {
      const start = new Date(data.startAt).getTime();
      const end = new Date(data.endAt).getTime();
      return end - start >= 10 * 60 * 1000;
    },
    {
      message: 'Interview duration must be at least 10 minutes',
      path: ['endAt'],
    }
  );

export type RescheduleInterviewInput = z.infer<typeof RescheduleInterviewSchema>;

export const CancelInterviewSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(1000),
});

export type CancelInterviewInput = z.infer<typeof CancelInterviewSchema>;

export const CompleteInterviewSchema = z.object({
  feedback: z.string().max(5000).optional().nullable(),
  result: z.enum(['passed', 'failed', 'pending', 'strong_hire']).optional().nullable(),
  interviewerNotes: z.string().max(5000).optional().nullable(),
});

export type CompleteInterviewInput = z.infer<typeof CompleteInterviewSchema>;

export const RecordNoShowSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

export type RecordNoShowInput = z.infer<typeof RecordNoShowSchema>;

export const UpdateFeedbackSchema = z.object({
  feedback: z.string().min(1, 'Feedback text cannot be empty').max(5000),
  result: z.enum(['passed', 'failed', 'pending', 'strong_hire']).optional().nullable(),
});

export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>;

export const InterviewQuerySchema = z.object({
  status: z.nativeEnum(InterviewStatus).optional(),
  jobId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  interviewerId: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});


export type InterviewQueryInput = z.infer<typeof InterviewQuerySchema>;

export interface OutboundCommunicationDto {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  recipientType: string;
  templateId: string;
  subject: string;
  status: CommunicationStatus | string;
  providerMessageId: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface InterviewHistoryDto {
  id: string;
  previousStatus: string;
  nextStatus: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
  } | null;
}

export interface InterviewDto {
  id: string;
  organizationId: string;
  clientId: string;
  jobId: string;
  applicationId: string;
  candidateId: string;
  interviewerUserProfileId: string;
  scheduledByUserProfileId: string | null;
  type: InterviewType | string;
  status: InterviewStatus | string;
  startAt: string;
  endAt: string;
  timeZone: string;
  meetingProvider: string | null;
  meetingUrl: string | null;
  location: string | null;
  sequence: number;
  interviewerNotes?: string | null; // Redacted for client role
  feedback: string | null;
  result: string | null;
  cancellationReason: string | null;
  candidate: {
    id: string;
    name: string;
    normalizedEmail: string;
    candidateCode: string;
  };
  job: {
    id: string;
    jobCode: string;
    title: string;
  };
  client: {
    id: string;
    name: string;
  };
  interviewer: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
  };
  scheduledBy?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
  } | null;
  communications?: OutboundCommunicationDto[];
  histories?: InterviewHistoryDto[];
  createdAt: string;
  updatedAt: string;
}
