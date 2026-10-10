import { prisma, allocateNextJobCode } from '@hiredesk/database';
import {
  CreateJobInput,
  UpdateJobInput,
  JobQueryInput,
  JobStatus,
  UserRole,
  PublicJobDto,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';

export interface JobWithMeta {
  id: string;
  organizationId: string;
  clientId: string;
  jobCode: string;
  title: string;
  department: string | null;
  employmentType: string;
  workplaceModel: string;
  country: string;
  currency: string;
  salaryMin: number | null;
  salaryMax: number | null;
  experienceYears: number;
  openings: number;
  deadline: string | null;
  education: string | null;
  skills: string[];
  description: string;
  requirements: string | null;
  status: string;
  applicationFormConfig: unknown;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
  };
  applicantCount: number;
}

export class JobService {
  /**
   * Creates a new job with atomic, server-generated Job Code.
   */
  static async createJob(user: AuthenticatedUser, input: CreateJobInput): Promise<JobWithMeta> {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to create jobs');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const organizationId = user.role === UserRole.SUPER_ADMIN ? user.organizationId : user.organizationId;
    if (!organizationId) {
      const err = new Error('Organization context is required to create a job');
      (err as any).statusCode = 400;
      (err as any).code = 'ORGANIZATION_REQUIRED';
      throw err;
    }

    // Verify client belongs to user's organization
    const client = await prisma.client.findFirst({
      where: {
        id: input.clientId,
        organizationId,
      },
    });

    if (!client) {
      const err = new Error('Specified client does not belong to your organization');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CLIENT';
      throw err;
    }

    // Allocate atomic, concurrency-safe global Job Code
    const jobCode = await allocateNextJobCode(prisma);

    const created = await prisma.job.create({
      data: {
        organizationId,
        clientId: client.id,
        jobCode,
        title: input.title,
        department: input.department || null,
        employmentType: input.employmentType,
        workplaceModel: input.workplaceModel,
        country: input.country,
        currency: input.currency || 'USD',
        salaryMin: input.salaryMin !== undefined ? input.salaryMin : null,
        salaryMax: input.salaryMax !== undefined ? input.salaryMax : null,
        experienceYears: input.experienceYears || 0,
        openings: input.openings || 1,
        deadline: input.deadline ? new Date(input.deadline) : null,
        education: input.education || null,
        skills: input.skills || [],
        description: input.description,
        requirements: input.requirements || null,
        status: input.status || JobStatus.DRAFT,
        applicationFormConfig: (input.applicationFormConfig || {}) as any,
        createdBy: user.id,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    return JobService.mapJobToMeta(created);
  }

  /**
   * Lists jobs with strict tenant and client scoping.
   */
  static async listJobs(user: AuthenticatedUser, query: JobQueryInput): Promise<{ jobs: JobWithMeta[]; total: number; page: number; limit: number }> {
    const where: any = {};

    // 1. Tenant boundary
    if (user.role !== UserRole.SUPER_ADMIN) {
      where.organizationId = user.organizationId!;
    }

    // 2. Client role boundary
    if (user.role === UserRole.CLIENT) {
      where.clientId = user.clientId!;
      // Clients may only view published/active jobs
      where.status = JobStatus.PUBLISHED;
    } else {
      if (query.status) {
        where.status = query.status;
      }
      if (query.clientId) {
        where.clientId = query.clientId;
      }
    }

    // 3. Search filter
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { department: { contains: query.search, mode: 'insensitive' } },
        { jobCode: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: {
            select: { id: true, name: true },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
    ]);

    return {
      jobs: items.map(JobService.mapJobToMeta),
      total,
      page,
      limit,
    };
  }

  /**
   * Retrieves single job enforcing tenant and client isolation.
   */
  static async getJobById(user: AuthenticatedUser, jobId: string): Promise<JobWithMeta> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Tenant check
    if (user.role !== UserRole.SUPER_ADMIN && job.organizationId !== user.organizationId) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404; // Non-disclosing 404
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Client user check
    if (user.role === UserRole.CLIENT) {
      if (job.clientId !== user.clientId || job.status !== JobStatus.PUBLISHED) {
        const err = new Error('Job not found');
        (err as any).statusCode = 404;
        (err as any).code = 'NOT_FOUND';
        throw err;
      }
    }

    return JobService.mapJobToMeta(job);
  }

  /**
   * Updates job fields while strictly protecting jobCode and organizationId immutability.
   */
  static async updateJob(user: AuthenticatedUser, jobId: string, input: UpdateJobInput): Promise<JobWithMeta> {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to modify jobs');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const existing = await JobService.getJobById(user, jobId);

    // If client is being reassigned, verify it belongs to the same organization
    if (input.clientId && input.clientId !== existing.clientId) {
      const client = await prisma.client.findFirst({
        where: {
          id: input.clientId,
          organizationId: existing.organizationId,
        },
      });
      if (!client) {
        const err = new Error('Specified client does not belong to the job organization');
        (err as any).statusCode = 400;
        (err as any).code = 'INVALID_CLIENT';
        throw err;
      }
    }

    // Explicitly exclude immutable fields: jobCode, organizationId, id
    const updateData: any = {};
    if (input.clientId) updateData.clientId = input.clientId;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.department !== undefined) updateData.department = input.department;
    if (input.employmentType !== undefined) updateData.employmentType = input.employmentType;
    if (input.workplaceModel !== undefined) updateData.workplaceModel = input.workplaceModel;
    if (input.country !== undefined) updateData.country = input.country;
    if (input.currency !== undefined) updateData.currency = input.currency;
    if (input.salaryMin !== undefined) updateData.salaryMin = input.salaryMin;
    if (input.salaryMax !== undefined) updateData.salaryMax = input.salaryMax;
    if (input.experienceYears !== undefined) updateData.experienceYears = input.experienceYears;
    if (input.openings !== undefined) updateData.openings = input.openings;
    if (input.deadline !== undefined) updateData.deadline = input.deadline ? new Date(input.deadline) : null;
    if (input.education !== undefined) updateData.education = input.education;
    if (input.skills !== undefined) updateData.skills = input.skills;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.requirements !== undefined) updateData.requirements = input.requirements;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.applicationFormConfig !== undefined) updateData.applicationFormConfig = input.applicationFormConfig as any;

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    return JobService.mapJobToMeta(updated);
  }

  /**
   * Updates job status (publish, close, reopen).
   */
  static async updateJobStatus(user: AuthenticatedUser, jobId: string, newStatus: JobStatus): Promise<JobWithMeta> {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to change job status');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const existing = await JobService.getJobById(user, jobId);

    // Validate allowed status transitions
    if (newStatus === JobStatus.PUBLISHED && existing.status === JobStatus.CLOSED) {
      // Reopening closed job to published is permitted
    } else if (newStatus === JobStatus.CLOSED && (existing.status === JobStatus.PUBLISHED || existing.status === JobStatus.DRAFT)) {
      // Closing draft or published job is permitted
    } else if (newStatus === JobStatus.PUBLISHED && existing.status === JobStatus.DRAFT) {
      // Publishing draft is permitted
    } else if (newStatus === existing.status) {
      return existing;
    }

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: newStatus },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    return JobService.mapJobToMeta(updated);
  }

  /**
   * Duplicates an existing job with a BRAND NEW, distinct atomic Job Code.
   */
  static async duplicateJob(user: AuthenticatedUser, jobId: string): Promise<JobWithMeta> {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to duplicate jobs');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    const source = await JobService.getJobById(user, jobId);
    const newJobCode = await allocateNextJobCode(prisma);

    const duplicated = await prisma.job.create({
      data: {
        organizationId: source.organizationId,
        clientId: source.clientId,
        jobCode: newJobCode,
        title: `${source.title} (Copy)`,
        department: source.department,
        employmentType: source.employmentType,
        workplaceModel: source.workplaceModel,
        country: source.country,
        currency: source.currency,
        salaryMin: source.salaryMin,
        salaryMax: source.salaryMax,
        experienceYears: source.experienceYears,
        openings: source.openings,
        deadline: source.deadline ? new Date(source.deadline) : null,
        education: source.education,
        skills: source.skills,
        description: source.description,
        requirements: source.requirements,
        status: JobStatus.DRAFT, // Clones start as draft
        applicationFormConfig: (source.applicationFormConfig || {}) as any,
        createdBy: user.id,
      },
      include: {
        client: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
    });

    return JobService.mapJobToMeta(duplicated);
  }

  /**
   * Public career jobs listing: returns ONLY published jobs for an active organization.
   * Strips internal metadata, recruiter notes, and client IDs.
   */
  static async getPublicCareerJobs(orgSlug: string): Promise<{ organization: { name: string; slug: string }; jobs: PublicJobDto[] }> {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug, status: 'active' },
      select: { id: true, name: true, slug: true },
    });

    if (!org) {
      const err = new Error('Organization not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const jobs = await prisma.job.findMany({
      where: {
        organizationId: org.id,
        status: JobStatus.PUBLISHED,
      },
      orderBy: { createdAt: 'desc' },
    });

    const publicJobs: PublicJobDto[] = jobs.map((j) => ({
      id: j.id,
      jobCode: j.jobCode,
      title: j.title,
      department: j.department,
      employmentType: j.employmentType as any,
      workplaceModel: j.workplaceModel as any,
      country: j.country,
      currency: j.currency,
      salaryMin: j.salaryMin ? Number(j.salaryMin) : null,
      salaryMax: j.salaryMax ? Number(j.salaryMax) : null,
      experienceYears: j.experienceYears,
      openings: j.openings,
      deadline: j.deadline ? j.deadline.toISOString() : null,
      education: j.education,
      skills: j.skills,
      description: j.description,
      requirements: j.requirements,
      organizationName: org.name,
      organizationSlug: org.slug,
      createdAt: j.createdAt.toISOString(),
    }));

    return {
      organization: { name: org.name, slug: org.slug },
      jobs: publicJobs,
    };
  }

  /**
   * Public career job detail: returns ONLY a published job by jobCode.
   */
  static async getPublicCareerJobByCode(orgSlug: string, jobCode: string): Promise<PublicJobDto> {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug, status: 'active' },
      select: { id: true, name: true, slug: true },
    });

    if (!org) {
      const err = new Error('Organization not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    const job = await prisma.job.findFirst({
      where: {
        organizationId: org.id,
        jobCode,
        status: JobStatus.PUBLISHED,
      },
    });

    if (!job) {
      const err = new Error('Job not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      id: job.id,
      jobCode: job.jobCode,
      title: job.title,
      department: job.department,
      employmentType: job.employmentType as any,
      workplaceModel: job.workplaceModel as any,
      country: job.country,
      currency: job.currency,
      salaryMin: job.salaryMin ? Number(job.salaryMin) : null,
      salaryMax: job.salaryMax ? Number(job.salaryMax) : null,
      experienceYears: job.experienceYears,
      openings: job.openings,
      deadline: job.deadline ? job.deadline.toISOString() : null,
      education: job.education,
      skills: job.skills,
      description: job.description,
      requirements: job.requirements,
      organizationName: org.name,
      organizationSlug: org.slug,
      createdAt: job.createdAt.toISOString(),
    };
  }

  private static mapJobToMeta(raw: any): JobWithMeta {
    return {
      id: raw.id,
      organizationId: raw.organizationId,
      clientId: raw.clientId,
      jobCode: raw.jobCode,
      title: raw.title,
      department: raw.department,
      employmentType: raw.employmentType,
      workplaceModel: raw.workplaceModel,
      country: raw.country,
      currency: raw.currency,
      salaryMin: raw.salaryMin ? Number(raw.salaryMin) : null,
      salaryMax: raw.salaryMax ? Number(raw.salaryMax) : null,
      experienceYears: raw.experienceYears,
      openings: raw.openings,
      deadline: raw.deadline ? new Date(raw.deadline).toISOString() : null,
      education: raw.education,
      skills: raw.skills,
      description: raw.description,
      requirements: raw.requirements,
      status: raw.status,
      applicationFormConfig: raw.applicationFormConfig,
      createdBy: raw.createdBy,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
      client: raw.client,
      applicantCount: raw._count?.applications || 0,
    };
  }
}
