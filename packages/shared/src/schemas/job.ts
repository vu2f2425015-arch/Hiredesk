import { z } from 'zod';
import { EmploymentType, JobStatus, WorkplaceModel } from '../enums.js';

export const CreateJobSchema = z.object({
  clientId: z.string().uuid({ message: 'Valid client ID is required' }),
  title: z.string().min(3, { message: 'Title must be at least 3 characters' }).max(255),
  department: z.string().max(100).optional(),
  employmentType: z.nativeEnum(EmploymentType),
  workplaceModel: z.nativeEnum(WorkplaceModel),
  country: z.string().min(2).max(100),
  currency: z.string().length(3).default('USD'),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  experienceYears: z.number().int().nonnegative().default(0),
  openings: z.number().int().positive().default(1),
  deadline: z.string().datetime().optional(),
  education: z.string().max(255).optional(),
  skills: z.array(z.string().min(1)).default([]),
  description: z.string().min(20, { message: 'Description must be at least 20 characters' }),
  requirements: z.string().optional(),
  status: z.nativeEnum(JobStatus).default(JobStatus.DRAFT),
  applicationFormConfig: z.record(z.unknown()).default({}),
});

export const UpdateJobSchema = CreateJobSchema.partial();

export const JobQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type JobQueryInput = z.infer<typeof JobQuerySchema>;
