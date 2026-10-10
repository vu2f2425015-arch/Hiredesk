import { z } from 'zod';
import { ApplicationStage } from '../enums.js';

export const CandidateCreateSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Valid email is required' }),
  phone: z.string().max(50).optional(),
  location: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  skills: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export const PublicApplySchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Valid email is required' }),
  phone: z.string().min(3, { message: 'Contact phone is required' }).max(50).optional(),
  answers: z.record(z.unknown()).default({}),
  honeypot: z.string().max(0).optional(),
});

export const PublicApplyResponseSchema = z.object({
  applicationId: z.string().uuid(),
  candidateCode: z.string(),
  status: z.string(),
  message: z.string(),
  isDuplicate: z.boolean().optional(),
});

export const ApplicationDtoSchema = z.object({
  id: z.string().uuid(),
  candidateId: z.string().uuid(),
  jobId: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientId: z.string().uuid(),
  stage: z.string(),
  source: z.string(),
  appliedAt: z.string(),
  status: z.string(),
  candidate: z.object({
    id: z.string().uuid(),
    candidateCode: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
  }),
  job: z.object({
    id: z.string().uuid(),
    jobCode: z.string(),
    title: z.string(),
  }).optional(),
  resumes: z.array(
    z.object({
      id: z.string().uuid(),
      originalFilename: z.string(),
      fileSize: z.number(),
      contentType: z.string(),
      uploadedAt: z.string(),
    })
  ),
});

export const ApplicationQuerySchema = z.object({
  stage: z.nativeEnum(ApplicationStage).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CandidateQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const StageTransitionSchema = z.object({
  stage: z.nativeEnum(ApplicationStage, {
    errorMap: () => ({ message: 'Invalid application stage' }),
  }),
  reason: z.string().max(500).optional(),
});

export const UpdateNotesSchema = z.object({
  recruiterNotes: z.string().max(5000).optional(),
  clientFeedback: z.string().max(5000).optional(),
});

export type CandidateCreateInput = z.infer<typeof CandidateCreateSchema>;
export type PublicApplyInput = z.infer<typeof PublicApplySchema>;
export type PublicApplyResponse = z.infer<typeof PublicApplyResponseSchema>;
export type ApplicationDto = z.infer<typeof ApplicationDtoSchema>;
export type ApplicationQueryInput = z.infer<typeof ApplicationQuerySchema>;
export type CandidateQueryInput = z.infer<typeof CandidateQuerySchema>;
export type StageTransitionInput = z.infer<typeof StageTransitionSchema>;
export type UpdateNotesInput = z.infer<typeof UpdateNotesSchema>;
