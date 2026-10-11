import { z } from 'zod';
import { ApplicationStage } from '../enums.js';

export const TalentPoolQuerySchema = z.object({
  search: z.string().max(100).optional(),
  skills: z.union([z.string(), z.array(z.string())]).optional(),
  location: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  candidateCode: z.string().max(50).optional(),
  stage: z.nativeEnum(ApplicationStage).optional(),
  jobId: z.string().uuid().optional(),
  jobCode: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  folderId: z.string().uuid().optional(),
  appliedAfter: z.string().optional(),
  appliedBefore: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'lastAppliedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const CreateTalentPoolFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name too long').trim(),
  description: z.string().max(500, 'Description too long').trim().optional(),
});

export const UpdateTalentPoolFolderSchema = z.object({
  name: z.string().min(1, 'Folder name cannot be empty').max(100, 'Folder name too long').trim().optional(),
  description: z.string().max(500, 'Description too long').trim().optional(),
});

export const AddCandidateToFolderSchema = z.object({
  candidateId: z.string().uuid('Valid candidate ID is required'),
});

export const AssociateCandidateWithJobSchema = z.object({
  jobId: z.string().uuid('Valid job ID is required'),
  source: z.string().max(100).default('talent_pool'),
  recruiterNotes: z.string().max(5000).optional(),
});

export type TalentPoolQueryInput = z.infer<typeof TalentPoolQuerySchema>;
export type CreateTalentPoolFolderInput = z.infer<typeof CreateTalentPoolFolderSchema>;
export type UpdateTalentPoolFolderInput = z.infer<typeof UpdateTalentPoolFolderSchema>;
export type AddCandidateToFolderInput = z.infer<typeof AddCandidateToFolderSchema>;
export type AssociateCandidateWithJobInput = z.infer<typeof AssociateCandidateWithJobSchema>;

export interface TalentPoolFolderDto {
  id: string;
  name: string;
  description: string | null;
  candidateCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TalentPoolCandidateApplicationDto {
  id: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  clientId: string;
  clientName: string;
  stage: string;
  source: string;
  appliedAt: string;
  recruiterNotes?: string;
  clientFeedback?: string;
}

export interface TalentPoolCandidateDto {
  id: string;
  candidateCode: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  country: string | null;
  skills: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalApplications: number;
  lastAppliedAt: string | null;
  lastStage: string | null;
  folders: Array<{ id: string; name: string }>;
  applications: TalentPoolCandidateApplicationDto[];
  resumeCount: number;
}

export interface TalentPoolListResponse {
  candidates: TalentPoolCandidateDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
