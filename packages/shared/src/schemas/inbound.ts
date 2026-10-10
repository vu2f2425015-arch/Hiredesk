import { z } from 'zod';
import { InboundStatus } from '../enums.js';

export const ManualAssignSchema = z.object({
  jobId: z.string().uuid({ message: 'Target job ID is required' }),
});

export const InboundQuerySchema = z.object({
  status: z.nativeEnum(InboundStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ManualAssignInput = z.infer<typeof ManualAssignSchema>;
export type InboundQueryInput = z.infer<typeof InboundQuerySchema>;
