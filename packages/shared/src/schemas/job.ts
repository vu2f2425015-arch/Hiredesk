import { z } from 'zod';
import { EmploymentType, JobStatus, WorkplaceModel } from '../enums.js';

export const CreateJobSchema = z
  .object({
    clientId: z.string().uuid({ message: 'Valid client ID is required' }),
    title: z.string().min(3, { message: 'Title must be at least 3 characters' }).max(255),
    department: z.string().max(100).optional(),
    employmentType: z.nativeEnum(EmploymentType),
    workplaceModel: z.nativeEnum(WorkplaceModel),
    country: z.string().min(2, { message: 'Country is required' }).max(100),
    currency: z.string().length(3).default('USD'),
    salaryMin: z.number().positive().optional(),
    salaryMax: z.number().positive().optional(),
    experienceYears: z.number().int().nonnegative().default(0),
    openings: z.number().int().positive().default(1),
    deadline: z.string().datetime().optional().nullable(),
    education: z.string().max(255).optional(),
    skills: z.array(z.string().min(1)).default([]),
    description: z.string().min(20, { message: 'Description must be at least 20 characters' }),
    requirements: z.string().optional(),
    status: z.nativeEnum(JobStatus).default(JobStatus.DRAFT),
    applicationFormConfig: z.record(z.unknown()).default({}).optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin !== undefined && data.salaryMax !== undefined) {
        return data.salaryMin <= data.salaryMax;
      }
      return true;
    },
    {
      message: 'salaryMin cannot exceed salaryMax',
      path: ['salaryMin'],
    }
  );

export const UpdateJobSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    title: z.string().min(3).max(255).optional(),
    department: z.string().max(100).optional().nullable(),
    employmentType: z.nativeEnum(EmploymentType).optional(),
    workplaceModel: z.nativeEnum(WorkplaceModel).optional(),
    country: z.string().min(2).max(100).optional(),
    currency: z.string().length(3).optional(),
    salaryMin: z.number().positive().optional().nullable(),
    salaryMax: z.number().positive().optional().nullable(),
    experienceYears: z.number().int().nonnegative().optional(),
    openings: z.number().int().positive().optional(),
    deadline: z.string().datetime().optional().nullable(),
    education: z.string().max(255).optional().nullable(),
    skills: z.array(z.string().min(1)).optional(),
    description: z.string().min(20).optional(),
    requirements: z.string().optional().nullable(),
    status: z.nativeEnum(JobStatus).optional(),
    applicationFormConfig: z.record(z.unknown()).optional(),
  })
  .refine(
    (data) => {
      if (data.salaryMin !== undefined && data.salaryMax !== undefined && data.salaryMin !== null && data.salaryMax !== null) {
        return data.salaryMin <= data.salaryMax;
      }
      return true;
    },
    {
      message: 'salaryMin cannot exceed salaryMax',
      path: ['salaryMin'],
    }
  );

export const JobQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PublicJobDtoSchema = z.object({
  id: z.string().uuid(),
  jobCode: z.string(),
  title: z.string(),
  department: z.string().nullable().optional(),
  employmentType: z.nativeEnum(EmploymentType),
  workplaceModel: z.nativeEnum(WorkplaceModel),
  country: z.string(),
  currency: z.string(),
  salaryMin: z.number().nullable().optional(),
  salaryMax: z.number().nullable().optional(),
  experienceYears: z.number(),
  openings: z.number(),
  deadline: z.string().nullable().optional(),
  education: z.string().nullable().optional(),
  skills: z.array(z.string()),
  description: z.string(),
  requirements: z.string().nullable().optional(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  createdAt: z.string(),
});

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type UpdateJobInput = z.infer<typeof UpdateJobSchema>;
export type JobQueryInput = z.infer<typeof JobQuerySchema>;
export type PublicJobDto = z.infer<typeof PublicJobDtoSchema>;
