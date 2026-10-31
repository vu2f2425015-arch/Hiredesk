import { prisma } from '@hiredesk/database';
import {
  UserRole,
  JobStatus,
  ApplicationStage,
  DashboardMetricsDto,
  DashboardAnalyticsQueryInput,
  AnalyticsReportQueryInput,
  FunnelReportDto,
  TimeToHireReportDto,
  CandidateSourceReportDto,
  RecruiterProductivityReportDto,
  JobOutcomesReportDto,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';

interface CachedMetrics {
  data: DashboardMetricsDto;
  expiresAt: number;
}

const metricsCache = new Map<string, CachedMetrics>();
const METRICS_CACHE_TTL_MS = 15 * 1000;

export function invalidateMetricsCache(organizationId?: string): void {
  if (!organizationId) {
    metricsCache.clear();
    return;
  }
  for (const key of metricsCache.keys()) {
    if (key.includes(organizationId)) {
      metricsCache.delete(key);
    }
  }
}

export class AnalyticsService {
  static invalidateCache(organizationId?: string): void {
    invalidateMetricsCache(organizationId);
  }

  /**
   * Computes database-backed dashboard metrics scoped to caller tenant and client role.
   */
  static async getDashboardMetrics(
    user: AuthenticatedUser,
    query: DashboardAnalyticsQueryInput = {}
  ): Promise<DashboardMetricsDto> {
    const cacheKey = `${user.role}:${user.organizationId || 'super'}:${user.clientId || 'none'}:${query.organizationId || 'all'}`;
    const cached = metricsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

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

    // Execute all independent aggregate and list queries concurrently in a single batch
    const [
      totalJobs,
      publishedJobs,
      draftJobs,
      closedJobs,
      totalCandidates,
      totalApplications,
      recentApplicationsCount,
      stageGroups,
      deadlineJobs,
      recentActivityLogs,
    ] = await Promise.all([
      prisma.job.count({ where: jobWhere }),
      prisma.job.count({ where: { ...jobWhere, status: JobStatus.PUBLISHED } }),
      user.role === UserRole.CLIENT ? Promise.resolve(0) : prisma.job.count({ where: { ...jobWhere, status: JobStatus.DRAFT } }),
      prisma.job.count({ where: { ...jobWhere, status: JobStatus.CLOSED } }),
      user.role === UserRole.CLIENT
        ? prisma.application.groupBy({ by: ['candidateId'], where: appWhere }).then((g) => g.length)
        : prisma.candidate.count({ where: candidateWhere }),
      prisma.application.count({ where: appWhere }),
      prisma.application.count({ where: { ...appWhere, appliedAt: { gte: sevenDaysAgo } } }),
      prisma.application.groupBy({
        by: ['stage'],
        _count: { id: true },
        where: appWhere,
      }),
      prisma.job.findMany({
        where: {
          ...jobWhere,
          status: JobStatus.PUBLISHED,
          deadline: {
            gte: now,
            lte: fourteenDaysAhead,
          },
        },
        orderBy: [{ deadline: 'asc' }, { id: 'asc' }],
        take: 10,
        select: {
          id: true,
          jobCode: true,
          title: true,
          deadline: true,
          client: {
            select: { name: true },
          },
        },
      }),
      prisma.activityLog.findMany({
        where: activityWhere,
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
        take: 10,
      }),
    ]);

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

    const result: DashboardMetricsDto = {
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

    metricsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + METRICS_CACHE_TTL_MS,
    });

    return result;
  }

  /**
   * Helper to build tenancy-scoped Application filter for reports.
   */
  private static buildReportWhere(user: AuthenticatedUser, query: AnalyticsReportQueryInput = {}) {
    const where: any = {};

    if (user.role === UserRole.SUPER_ADMIN) {
      if (user.organizationId) where.organizationId = user.organizationId;
    } else if (user.role === UserRole.CLIENT) {
      if (!user.clientId) {
        const err = new Error('Client user has no associated client profile');
        (err as any).statusCode = 403;
        (err as any).code = 'FORBIDDEN';
        throw err;
      }
      where.organizationId = user.organizationId;
      where.clientId = user.clientId;
    } else {
      if (!user.organizationId) {
        const err = new Error('Organization context required');
        (err as any).statusCode = 400;
        (err as any).code = 'ORGANIZATION_REQUIRED';
        throw err;
      }
      where.organizationId = user.organizationId;
    }

    if (query.jobId) where.jobId = query.jobId;
    if (query.clientId && user.role !== UserRole.CLIENT) where.clientId = query.clientId;

    if (query.startDate || query.endDate) {
      where.appliedAt = {};
      if (query.startDate) where.appliedAt.gte = new Date(query.startDate);
      if (query.endDate) where.appliedAt.lte = new Date(query.endDate);
    }

    return where;
  }

  /**
   * GET /api/analytics/reports/funnel
   * Database-backed hiring funnel report with canonical stage conversion percentages.
   */
  static async getFunnelReport(user: AuthenticatedUser, query: AnalyticsReportQueryInput): Promise<FunnelReportDto> {
    const where = this.buildReportWhere(user, query);

    const [totalApplications, stageGroups] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.groupBy({
        by: ['stage'],
        where,
        _count: { id: true },
      }),
    ]);

    const stageCountMap: Record<string, number> = {};
    for (const g of stageGroups) {
      stageCountMap[g.stage] = g._count.id;
    }

    const canonicalStages = [
      ApplicationStage.APPLIED,
      ApplicationStage.SCREENING,
      ApplicationStage.SHORTLISTED,
      ApplicationStage.INTERVIEW,
      ApplicationStage.AI_INTERVIEW,
      ApplicationStage.CLIENT_REVIEW,
      ApplicationStage.SELECTED,
      ApplicationStage.HIRED,
      ApplicationStage.REJECTED,
      ApplicationStage.WITHDRAWN,
    ];

    let previousCount = totalApplications;
    const stages = canonicalStages.map((stageName) => {
      const count = stageCountMap[stageName] || 0;
      const conversionFromApplied = totalApplications > 0 ? Math.round((count / totalApplications) * 1000) / 10 : 0;
      const conversionFromPrevious = previousCount > 0 ? Math.round((count / previousCount) * 1000) / 10 : 0;
      if (stageName !== ApplicationStage.REJECTED && stageName !== ApplicationStage.WITHDRAWN) {
        previousCount = count > 0 ? count : previousCount;
      }

      return {
        stage: stageName,
        count,
        conversionFromApplied,
        conversionFromPrevious,
      };
    });

    return {
      totalApplications,
      stages,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * GET /api/analytics/reports/time-to-hire
   * Time in stage and time to hire calculated from StageHistory timestamps.
   */
  static async getTimeToHireReport(user: AuthenticatedUser, query: AnalyticsReportQueryInput): Promise<TimeToHireReportDto> {
    const where = this.buildReportWhere(user, query);

    // Fetch applications that reached HIRED stage with their stage history
    const hiredApplications = await prisma.application.findMany({
      where: {
        ...where,
        stage: ApplicationStage.HIRED,
      },
      include: {
        stageHistories: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    const durationsInDays: number[] = [];
    for (const app of hiredApplications) {
      const hiredHistory = app.stageHistories.find((sh) => sh.nextStage === ApplicationStage.HIRED);
      const hireDate = hiredHistory ? hiredHistory.timestamp : app.updatedAt;
      const diffMs = hireDate.getTime() - app.appliedAt.getTime();
      const diffDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      durationsInDays.push(diffDays);
    }

    durationsInDays.sort((a, b) => a - b);

    const totalHired = durationsInDays.length;
    let averageDaysToHire = 0;
    let medianDaysToHire = 0;
    let fastestDaysToHire = 0;
    let slowestDaysToHire = 0;

    if (totalHired > 0) {
      const sum = durationsInDays.reduce((acc, v) => acc + v, 0);
      averageDaysToHire = Math.round((sum / totalHired) * 10) / 10;
      const mid = Math.floor(totalHired / 2);
      medianDaysToHire = totalHired % 2 !== 0 ? durationsInDays[mid] : Math.round(((durationsInDays[mid - 1] + durationsInDays[mid]) / 2) * 10) / 10;
      fastestDaysToHire = durationsInDays[0];
      slowestDaysToHire = durationsInDays[totalHired - 1];
    }

    // Calculate stage durations across all applications in scope
    const allApplicationsWithHistories = await prisma.application.findMany({
      where,
      select: {
        appliedAt: true,
        stageHistories: {
          orderBy: { timestamp: 'asc' },
          select: {
            previousStage: true,
            nextStage: true,
            timestamp: true,
          },
        },
      },
      take: 200,
    });

    const stageDurationsMap: Record<string, number[]> = {};
    for (const app of allApplicationsWithHistories) {
      let lastTime = app.appliedAt;
      for (const sh of app.stageHistories) {
        const stageName = sh.previousStage === 'None' ? ApplicationStage.APPLIED : sh.previousStage;
        const durationDays = Math.max(0, Math.round((sh.timestamp.getTime() - lastTime.getTime()) / (1000 * 60 * 60 * 24)));
        if (!stageDurationsMap[stageName]) stageDurationsMap[stageName] = [];
        stageDurationsMap[stageName].push(durationDays);
        lastTime = sh.timestamp;
      }
    }

    const stageAverages = Object.entries(stageDurationsMap).map(([stage, durations]) => {
      const avg = durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;
      return { stage, averageDaysInStage: avg };
    });

    return {
      totalHired,
      averageDaysToHire,
      medianDaysToHire,
      fastestDaysToHire,
      slowestDaysToHire,
      stageAverages,
    };
  }

  /**
   * GET /api/analytics/reports/sources
   * Candidate source breakdown with hiring outcome counts.
   */
  static async getCandidateSourcesReport(
    user: AuthenticatedUser,
    query: AnalyticsReportQueryInput
  ): Promise<CandidateSourceReportDto> {
    const where = this.buildReportWhere(user, query);

    const [totalApplications, sourceGroups, hiredBySource] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.groupBy({
        by: ['source'],
        where,
        _count: { id: true },
      }),
      prisma.application.groupBy({
        by: ['source'],
        where: { ...where, stage: ApplicationStage.HIRED },
        _count: { id: true },
      }),
    ]);

    const hiredCountMap: Record<string, number> = {};
    for (const h of hiredBySource) {
      hiredCountMap[h.source] = h._count.id;
    }

    const sources = sourceGroups.map((g) => {
      const count = g._count.id;
      const percentage = totalApplications > 0 ? Math.round((count / totalApplications) * 1000) / 10 : 0;
      return {
        source: g.source,
        count,
        percentage,
        hiredCount: hiredCountMap[g.source] || 0,
      };
    });

    return {
      totalApplications,
      sources,
    };
  }

  /**
   * GET /api/analytics/reports/productivity
   * Recruiter productivity based on auditable stage transitions, scheduled interviews, and activity logs.
   * Client users are strictly denied.
   */
  static async getRecruiterProductivityReport(
    user: AuthenticatedUser,
    query: AnalyticsReportQueryInput
  ): Promise<RecruiterProductivityReportDto> {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to access recruiter productivity reports');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    if (!user.organizationId) {
      const err = new Error('Organization context required');
      (err as any).statusCode = 400;
      throw err;
    }

    // 1. Fetch team members (recruiters and managers) in the organization
    const teamMembers = await prisma.userProfile.findMany({
      where: {
        organizationId: user.organizationId,
        role: { in: [UserRole.RECRUITER, UserRole.MANAGER] },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    const dateFilter: any = {};
    if (query.startDate) dateFilter.gte = new Date(query.startDate);
    if (query.endDate) dateFilter.lte = new Date(query.endDate);
    const hasDate = query.startDate || query.endDate;

    // 2. Aggregate productivity metrics per recruiter
    const recruiters = await Promise.all(
      teamMembers.map(async (m) => {
        const stageHistoryWhere: any = {
          actorId: m.id,
          application: { organizationId: user.organizationId },
        };
        if (hasDate) stageHistoryWhere.timestamp = dateFilter;

        const interviewWhere: any = {
          interviewerUserProfileId: m.id,
          organizationId: user.organizationId,
        };
        if (hasDate) interviewWhere.createdAt = dateFilter;

        const notesWhere: any = {
          actorId: m.id,
          organizationId: user.organizationId,
          action: { in: ['NOTES_UPDATED', 'FEEDBACK_SUBMITTED'] },
        };
        if (hasDate) notesWhere.timestamp = dateFilter;

        const [stageTransitionsCount, interviewsScheduledCount, notesLoggedCount] = await Promise.all([
          prisma.stageHistory.count({ where: stageHistoryWhere }),
          prisma.interview.count({ where: interviewWhere }),
          prisma.activityLog.count({ where: notesWhere }),
        ]);

        return {
          recruiterId: m.id,
          recruiterName: `${m.firstName} ${m.lastName}`.trim(),
          email: m.email,
          stageTransitionsCount,
          interviewsScheduledCount,
          notesLoggedCount,
        };
      })
    );

    return {
      period: {
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
      recruiters,
    };
  }

  /**
   * GET /api/analytics/reports/jobs
   * Job-level application counts and hiring outcomes.
   */
  static async getJobOutcomesReport(
    user: AuthenticatedUser,
    query: AnalyticsReportQueryInput
  ): Promise<JobOutcomesReportDto> {
    const jobWhere: any = {};
    if (user.role === UserRole.CLIENT) {
      if (!user.clientId) {
        const err = new Error('Client profile required');
        (err as any).statusCode = 403;
        throw err;
      }
      jobWhere.organizationId = user.organizationId;
      jobWhere.clientId = user.clientId;
    } else {
      if (!user.organizationId) {
        const err = new Error('Organization context required');
        (err as any).statusCode = 400;
        throw err;
      }
      jobWhere.organizationId = user.organizationId;
      if (query.clientId) jobWhere.clientId = query.clientId;
    }

    if (query.jobId) jobWhere.id = query.jobId;

    const jobs = await prisma.job.findMany({
      where: jobWhere,
      include: {
        client: {
          select: { name: true },
        },
        applications: {
          select: {
            id: true,
            stage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const reportJobs = jobs.map((j) => {
      const total = j.applications.length;
      let hired = 0;
      let rejected = 0;
      let active = 0;

      for (const app of j.applications) {
        if (app.stage === ApplicationStage.HIRED) hired++;
        else if (app.stage === ApplicationStage.REJECTED || app.stage === ApplicationStage.WITHDRAWN) rejected++;
        else active++;
      }

      return {
        jobId: j.id,
        jobCode: j.jobCode,
        title: j.title,
        clientName: j.client?.name || '',
        status: j.status,
        totalApplications: total,
        activeCount: active,
        hiredCount: hired,
        rejectedCount: rejected,
      };
    });

    return { jobs: reportJobs };
  }
}
