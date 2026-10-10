import { describe, it, expect } from 'vitest';
import {
  UserRole,
  JobStatus,
  ApplicationStage,
  InboundStatus,
  CreateJobSchema,
  EmploymentType,
  WorkplaceModel,
} from '../src/index.js';

describe('Shared Package Contracts', () => {
  it('should export valid domain enums', () => {
    expect(UserRole.RECRUITER).toBe('recruiter');
    expect(UserRole.CLIENT).toBe('client');
    expect(JobStatus.PUBLISHED).toBe('published');
    expect(ApplicationStage.APPLIED).toBe('Applied');
    expect(InboundStatus.UNMATCHED).toBe('unmatched');
  });

  it('should validate CreateJobSchema correctly', () => {
    const validJob = {
      clientId: '123e4567-e89b-12d3-a456-426614174000',
      title: 'Senior Software Engineer',
      employmentType: EmploymentType.FULL_TIME,
      workplaceModel: WorkplaceModel.REMOTE,
      country: 'United States',
      description: 'We are seeking a senior software engineer to build scalable services.',
    };

    const parsed = CreateJobSchema.safeParse(validJob);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe(JobStatus.DRAFT);
      expect(parsed.data.currency).toBe('USD');
    }
  });

  it('should reject invalid CreateJobSchema input', () => {
    const invalidJob = {
      title: 'No', // too short (< 3)
      employmentType: 'freelance', // invalid enum
    };

    const parsed = CreateJobSchema.safeParse(invalidJob);
    expect(parsed.success).toBe(false);
  });
});
