import { z } from 'zod';
import { ApplicationStage, UserRole, InterviewRequestStatus } from '../enums.js';

export const ClientPortalShortlistSchema = z.object({
  notes: z.string().max(500).optional(),
});

export const ClientPortalRejectSchema = z.object({
  reason: z.string().min(1, { message: 'Rejection reason is required' }).max(500),
});

export const ClientPortalRequestInterviewSchema = z.object({
  preferredTimes: z.array(z.string().max(200)).optional().default([]),
  notes: z.string().max(1000).optional(),
});

export const ClientPortalFeedbackSchema = z.object({
  feedback: z.string().min(1, { message: 'Feedback text is required' }).max(5000),
});

export const ClientPortalJobQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ClientPortalApplicationQuerySchema = z.object({
  stage: z.nativeEnum(ApplicationStage).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const ClientPortalMeDtoSchema = z.object({
  user: z.object({
    id: z.string(),
    authUserId: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    fullName: z.string().nullable(),
    role: z.literal(UserRole.CLIENT),
    organizationId: z.string(),
    organizationName: z.string().nullable(),
    clientId: z.string(),
    clientName: z.string().nullable(),
  }),
  client: z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }),
});

export const ClientPortalJobDtoSchema = z.object({
  id: z.string().uuid(),
  jobCode: z.string(),
  title: z.string(),
  department: z.string().nullable().optional(),
  employmentType: z.string(),
  workplaceModel: z.string(),
  country: z.string(),
  openings: z.number(),
  deadline: z.string().nullable().optional(),
  status: z.string(),
  applicantCount: z.number(),
  reviewCount: z.number(),
  shortlistedCount: z.number(),
});

export const ClientPortalApplicationDtoSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  jobCode: z.string(),
  jobTitle: z.string(),
  stage: z.string(),
  appliedAt: z.string(),
  status: z.string(),
  candidate: z.object({
    id: z.string().uuid(),
    candidateCode: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    skills: z.array(z.string()).default([]),
  }),
  answers: z.record(z.unknown()).default({}),
  clientFeedback: z.string().nullable().optional(),
  resumes: z.array(
    z.object({
      id: z.string().uuid(),
      originalFilename: z.string(),
      fileSize: z.number(),
      contentType: z.string(),
      uploadedAt: z.string(),
    })
  ),
  stageHistories: z.array(
    z.object({
      id: z.string().uuid(),
      previousStage: z.string(),
      nextStage: z.string(),
      reason: z.string().nullable().optional(),
      timestamp: z.string(),
    })
  ),
  interviewRequests: z.array(
    z.object({
      id: z.string().uuid(),
      status: z.string(),
      preferredTimes: z.array(z.string()).default([]),
      notes: z.string().nullable().optional(),
      createdAt: z.string(),
    })
  ),
});

export const ClientPortalInterviewRequestResponseSchema = z.object({
  id: z.string().uuid(),
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  clientId: z.string().uuid(),
  status: z.literal(InterviewRequestStatus.PENDING),
  preferredTimes: z.array(z.string()),
  notes: z.string().nullable().optional(),
  message: z.string(),
  createdAt: z.string(),
});

export type ClientPortalShortlistInput = z.infer<typeof ClientPortalShortlistSchema>;
export type ClientPortalRejectInput = z.infer<typeof ClientPortalRejectSchema>;
export type ClientPortalRequestInterviewInput = z.infer<typeof ClientPortalRequestInterviewSchema>;
export type ClientPortalFeedbackInput = z.infer<typeof ClientPortalFeedbackSchema>;
export type ClientPortalJobQueryInput = z.infer<typeof ClientPortalJobQuerySchema>;
export type ClientPortalApplicationQueryInput = z.infer<typeof ClientPortalApplicationQuerySchema>;
export type ClientPortalMeDto = z.infer<typeof ClientPortalMeDtoSchema>;
export type ClientPortalJobDto = z.infer<typeof ClientPortalJobDtoSchema>;
export type ClientPortalApplicationDto = z.infer<typeof ClientPortalApplicationDtoSchema>;
export type ClientPortalInterviewRequestResponse = z.infer<typeof ClientPortalInterviewRequestResponseSchema>;
