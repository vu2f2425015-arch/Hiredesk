import { z } from 'zod';

export const AiRecruiterMatchRequestSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
});

export type AiRecruiterMatchRequestInput = z.infer<typeof AiRecruiterMatchRequestSchema>;

export interface AiRecruiterStatusDto {
  providerConfigured: boolean;
  providerName: 'deterministic_baseline' | 'google_gemini' | 'anthropic_claude' | 'openai';
  model: string | null;
  capabilities: string[];
  message: string;
}

export type AiMatchTier = 'Strong Fit' | 'Moderate Fit' | 'Growth Potential' | 'Low Overlap';

export interface AiRecruiterMatchEvaluationDto {
  applicationId: string;
  jobId: string;
  candidateId: string;
  provider: 'deterministic_baseline' | 'google_gemini' | 'anthropic_claude' | 'openai';
  model: string | null;
  promptVersion: string;
  evaluatedAt: string;
  limitationNotice?: string;
  skillsMatch: {
    matchedSkills: string[];
    missingSkills: string[];
    overlapRatio: number; // 0.0 to 1.0 (exact math: matched / total required)
    totalRequiredSkillsCount: number;
    totalCandidateSkillsCount: number;
  };
  experienceMatch: {
    requiredYears: number | null;
    estimatedCandidateYears: number | null;
    meetsExperience: boolean;
  };
  matchTier: AiMatchTier;
  strengths: string[];
  gaps: string[];
  interviewFocusAreas: string[];
  decisionSupportDisclaimer: string;
}
