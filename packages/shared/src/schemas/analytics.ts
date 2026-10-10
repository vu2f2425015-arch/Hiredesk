import { z } from 'zod';

export const DashboardAnalyticsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export type DashboardAnalyticsQueryInput = z.infer<typeof DashboardAnalyticsQuerySchema>;

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
