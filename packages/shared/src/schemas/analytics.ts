import { z } from 'zod';

export const DashboardAnalyticsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const AnalyticsReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  jobId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
});

export type DashboardAnalyticsQueryInput = z.infer<typeof DashboardAnalyticsQuerySchema>;
export type AnalyticsReportQueryInput = z.infer<typeof AnalyticsReportQuerySchema>;

export interface DashboardMetricsDto {
  totalJobs: number;
  publishedJobs: number;
  draftJobs: number;
  closedJobs: number;
  totalCandidates: number;
  totalApplications: number;
  recentApplicationsCount: number;
  stageCounts: Record<string, number>;
  jobsApproachingDeadline: Array<{
    id: string;
    jobCode: string;
    title: string;
    clientName: string;
    deadline: string;
    daysRemaining: number;
  }>;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    action: string;
    entityType: string;
    entityId: string;
    details: any;
  }>;
}

export interface FunnelStageMetric {
  stage: string;
  count: number;
  conversionFromApplied: number; // percentage
  conversionFromPrevious: number; // percentage
}

export interface FunnelReportDto {
  totalApplications: number;
  stages: FunnelStageMetric[];
  generatedAt: string;
}

export interface TimeToHireReportDto {
  totalHired: number;
  averageDaysToHire: number;
  medianDaysToHire: number;
  fastestDaysToHire: number;
  slowestDaysToHire: number;
  stageAverages: Array<{
    stage: string;
    averageDaysInStage: number;
  }>;
}

export interface CandidateSourceMetric {
  source: string;
  count: number;
  percentage: number;
  hiredCount: number;
}

export interface CandidateSourceReportDto {
  totalApplications: number;
  sources: CandidateSourceMetric[];
}

export interface RecruiterProductivityMetric {
  recruiterId: string;
  recruiterName: string;
  email: string;
  stageTransitionsCount: number;
  interviewsScheduledCount: number;
  notesLoggedCount: number;
}

export interface RecruiterProductivityReportDto {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  recruiters: RecruiterProductivityMetric[];
}

export interface JobOutcomeMetric {
  jobId: string;
  jobCode: string;
  title: string;
  clientName: string;
  status: string;
  totalApplications: number;
  activeCount: number;
  hiredCount: number;
  rejectedCount: number;
}

export interface JobOutcomesReportDto {
  jobs: JobOutcomeMetric[];
}
