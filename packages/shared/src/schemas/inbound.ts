import { z } from 'zod';
import { InboundStatus } from '../enums.js';

export const ManualAssignSchema = z.object({
  jobId: z.string().uuid({ message: 'Target job ID must be a valid UUID' }),
});

export const IgnoreInboundSchema = z.object({
  reason: z.string().min(1, { message: 'Reason for ignoring is required' }).max(500),
});

export const InboundQuerySchema = z.object({
  status: z.nativeEnum(InboundStatus).optional(),
  jobCode: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ManualAssignInput = z.infer<typeof ManualAssignSchema>;
export type IgnoreInboundInput = z.infer<typeof IgnoreInboundSchema>;
export type InboundQueryInput = z.infer<typeof InboundQuerySchema>;

export const INBOUND_FAILURE_REASONS = {
  NO_JOB_CODE: 'no_job_code',
  JOB_CODE_NOT_FOUND: 'job_code_not_found',
  AMBIGUOUS_JOB_CODE: 'ambiguous_job_code',
  JOB_NOT_ACCEPTING_APPLICATIONS: 'job_not_accepting_applications',
  PARSE_FAILED: 'parse_failed',
  PARSE_FAILED_MISSING_EMAIL: 'parse_failed_missing_email',
  PARSE_FAILED_MISSING_NAME: 'parse_failed_missing_name',
  RESUME_MISSING: 'resume_missing',
  RESUME_INVALID: 'resume_invalid',
  STORAGE_FAILED: 'storage_failed',
  DATABASE_FAILED: 'database_failed',
} as const;
