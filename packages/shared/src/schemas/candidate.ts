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
  name: z.string().min(2, { message: 'Name is required' }),
  email: z.string().email({ message: 'Valid email is required' }),
  phone: z.string().min(5, { message: 'Contact phone is required' }),
  answers: z.record(z.unknown()).default({}),
});

export const StageTransitionSchema = z.object({
  stage: z.nativeEnum(ApplicationStage),
  reason: z.string().max(500).optional(),
});

export type CandidateCreateInput = z.infer<typeof CandidateCreateSchema>;
export type PublicApplyInput = z.infer<typeof PublicApplySchema>;
export type StageTransitionInput = z.infer<typeof StageTransitionSchema>;
