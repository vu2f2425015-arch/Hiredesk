import { prisma } from '@hiredesk/database';
import {
  UserRole,
  JobStatus,
  ApplicationStage,
  DashboardMetricsDto,
  DashboardAnalyticsQueryInput,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';

export class AnalyticsService {
  /**
   * Computes database-backed dashboard metrics scoped to caller tenant and client role.
   */
  static async getDashboardMetrics(
    user: AuthenticatedUser,
    query: DashboardAnalyticsQueryInput = {}
  ): Promise<DashboardMetricsDto> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Build base query conditions according to role and tenancy
    const jobWhere: any = {};
    const appWhere: any = {};
    const candidateWhere: any = {};
    const activityWhere: any = {};

    if (user.role === UserRole.SUPER_ADMIN) {
      if (query.organizationId) {
        jobWhere.organizationId = query.organizationId;
        appWhere.organizationId = query.organizationId;
        candidateWhere.organizationId = query.organizationId;
        activityWhere.organizationId = query.organizationId;
      }
    } else if (user.role === UserRole.CLIENT) {
      if (!user.clientId) {
        const err = new Error('Client user has no associated client profile');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
      jobWhere.clientId = user.clientId;
      jobWhere.organizationId = user.organizationId;
      appWhere.clientId = user.clientId;
      appWhere.organizationId = user.organizationId;
      // Client only sees published or closed jobs, never draft jobs
      jobWhere.status = { not: JobStatus.DRAFT };
      activityWhere.organizationId = user.organizationId;
      activityWhere.visibility = 'client_visible';
    } else {
      // Manager and Recruiter
      if (!user.organizationId) {
        const err = new Error('User has no associated organization');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
      jobWhere.organizationId = user.organizationId;
      appWhere.organizationId = user.organizationId;
      candidateWhere.organizationId = user.organizationId;
      activityWhere.organizationId = user.organizationId;
    }

    // 1. Job counts
    const [totalJobs, publishedJobs, draftJobs, closedJobs] = await Promise.all([
      prisma.job.count({ where: jobWhere }),
      prisma.job.count({ where: { ...jobWhere, status: JobStatus.PUBLISHED } }),
      user.role === UserRole.CLIENT ? 0 : prisma.job.count({ where: { ...jobWhere, status: JobStatus.DRAFT } }),
      prisma.job.count({ where: { ...jobWhere, status: JobStatus.CLOSED } }),
    ]);

    // 2. Candidate counts
    let totalCandidates = 0;
    if (user.role === UserRole.CLIENT) {
      // Distinct candidates who applied for this client's jobs
      const groups = await prisma.application.groupBy({
        by: ['candidateId'],
        where: appWhere,
      });
      totalCandidates = groups.length;
    } else {
      // Distinct candidates in the organization
      totalCandidates = await prisma.candidate.count({ where: candidateWhere });
    }

    // 3. Application counts
    const [totalApplications, recentApplicationsCount] = await Promise.all([
      prisma.application.count({ where: appWhere }),
      prisma.application.count({
        where: {
          ...appWhere,
          appliedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    // 4. Stage distribution counts
    const stageGroups = await prisma.application.groupBy({
      by: ['stage'],
      _count: { id: true },
      where: appWhere,
    });

    const stageCounts: Record<string, number> = {
      [ApplicationStage.APPLIED]: 0,
      [ApplicationStage.SCREENING]: 0,
      [ApplicationStage.SHORTLISTED]: 0,
      [ApplicationStage.INTERVIEW]: 0,
      [ApplicationStage.AI_INTERVIEW]: 0,
      [ApplicationStage.CLIENT_REVIEW]: 0,
      [ApplicationStage.SELECTED]: 0,
      [ApplicationStage.HIRED]: 0,
      [ApplicationStage.REJECTED]: 0,
      [ApplicationStage.WITHDRAWN]: 0,
    };

    for (const group of stageGroups) {
      if (group.stage) {
        stageCounts[group.stage] = group._count.id;
      }
    }

    // 5. Jobs approaching deadline (next 14 days)
    const deadlineJobs = await prisma.job.findMany({
      where: {
        ...jobWhere,
        status: JobStatus.PUBLISHED,
        deadline: {
          gte: now,
          lte: fourteenDaysAhead,
        },
      },
      orderBy: { deadline: 'asc' },
      take: 10,
      include: {
        client: {
          select: { name: true },
        },
      },
    });

    const jobsApproachingDeadline = deadlineJobs
      .filter((j) => j.deadline)
      .map((j) => {
        const deadlineDate = new Date(j.deadline!);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        return {
          id: j.id,
          jobCode: j.jobCode,
          title: j.title,
          clientName: j.client?.name || '',
          deadline: isNaN(deadlineDate.getTime()) ? new Date().toISOString() : deadlineDate.toISOString(),
          daysRemaining,
        };
      });

    // 6. Recent activity (last 10 entries)
    const recentActivityLogs = await prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const recentActivity = recentActivityLogs.map((a: any) => {
      const rawDate = a.timestamp || a.createdAt;
      const parsedDate = rawDate instanceof Date ? rawDate : (rawDate ? new Date(rawDate) : new Date());
      const safeIso = isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

      return {
        id: a.id,
        timestamp: safeIso,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        details: a.details,
        actor: a.actor || null,
      };
    });

    return {
      totalJobs,
      publishedJobs,
      draftJobs,
      closedJobs,
      totalCandidates,
      totalApplications,
      recentApplicationsCount,
      stageCounts,
      jobsApproachingDeadline,
      recentActivity,
      // Nested conveniences for UI and test assertions
      jobs: {
        total: totalJobs,
        active: publishedJobs,
        published: publishedJobs,
        draft: draftJobs,
        closed: closedJobs,
      },
      candidates: {
        total: totalCandidates,
      },
      applications: {
        total: totalApplications,
        recent: recentApplicationsCount,
      },
      stages: stageCounts,
    } as any;
  }
}
