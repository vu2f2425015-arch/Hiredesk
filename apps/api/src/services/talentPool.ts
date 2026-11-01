import { prisma } from '@hiredesk/database';
import {
  TalentPoolQueryInput,
  CreateTalentPoolFolderInput,
  UpdateTalentPoolFolderInput,
  AssociateCandidateWithJobInput,
  TalentPoolListResponse,
  TalentPoolCandidateDto,
  TalentPoolFolderDto,
  UserRole,
  ApplicationStage,
} from '@hiredesk/shared';
import { AuthenticatedUser } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

interface CachedTalentPoolEntry<T> {
  data: T;
  expiresAt: number;
}

const talentPoolCache = new Map<string, CachedTalentPoolEntry<any>>();
const TALENT_POOL_CACHE_TTL_MS = 30 * 1000; // 30 seconds TTL

export function invalidateTalentPoolCache(organizationId?: string): void {
  if (!organizationId) {
    talentPoolCache.clear();
    return;
  }
  for (const key of talentPoolCache.keys()) {
    if (key.includes(organizationId)) {
      talentPoolCache.delete(key);
    }
  }
}

export class TalentPoolService {
  static invalidateCache(organizationId?: string): void {
    invalidateTalentPoolCache(organizationId);
  }

  /**
   * Validates that the caller has recruiter/manager authorization
   * and non-null organization context. Client users are strictly denied.
   */
  private static validateRecruiterScope(user: AuthenticatedUser): string {
    if (user.role === UserRole.CLIENT) {
      const err = new Error('Client users are not permitted to access the Talent Pool');
      (err as any).statusCode = 403;
      (err as any).code = 'FORBIDDEN';
      throw err;
    }

    if (!user.organizationId) {
      const err = new Error('Organization context is required for Talent Pool operations');
      (err as any).statusCode = 400;
      (err as any).code = 'ORGANIZATION_REQUIRED';
      throw err;
    }

    return user.organizationId;
  }

  /**
   * GET /api/talent-pool/candidates
   * Lists organization-scoped candidates with server-side filtering, search, and pagination.
   */
  static async listCandidates(
    user: AuthenticatedUser,
    query: TalentPoolQueryInput
  ): Promise<TalentPoolListResponse> {
    const organizationId = this.validateRecruiterScope(user);

    const cacheKey = `tp:candidates:${organizationId}:${JSON.stringify(query)}`;
    const cached = talentPoolCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const where: any = {
      organizationId,
    };

    // Text search across candidate fields
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { normalizedEmail: { contains: term.toLowerCase(), mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { country: { contains: term, mode: 'insensitive' } },
        { candidateCode: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Filter by specific candidate code
    if (query.candidateCode) {
      where.candidateCode = { contains: query.candidateCode.trim(), mode: 'insensitive' };
    }

    // Filter by location / country
    if (query.location) {
      where.location = { contains: query.location.trim(), mode: 'insensitive' };
    }
    if (query.country) {
      where.country = { contains: query.country.trim(), mode: 'insensitive' };
    }

    // Filter by skills
    if (query.skills) {
      const skillsArray = Array.isArray(query.skills)
        ? query.skills
        : query.skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillsArray.length > 0) {
        where.skills = {
          hasSome: skillsArray,
        };
      }
    }

    // Filter by folder membership
    if (query.folderId) {
      where.folderMemberships = {
        some: {
          folderId: query.folderId,
          folder: { organizationId },
        },
      };
    }

    // Application-level sub-filters
    const applicationConditions: any = {
      organizationId,
    };
    let hasApplicationFilter = false;

    if (query.stage) {
      applicationConditions.stage = query.stage;
      hasApplicationFilter = true;
    }
    if (query.jobId) {
      applicationConditions.jobId = query.jobId;
      hasApplicationFilter = true;
    }
    if (query.jobCode) {
      applicationConditions.job = {
        jobCode: { contains: query.jobCode.trim(), mode: 'insensitive' },
      };
      hasApplicationFilter = true;
    }
    if (query.source) {
      applicationConditions.source = { contains: query.source.trim(), mode: 'insensitive' };
      hasApplicationFilter = true;
    }
    if (query.appliedAfter || query.appliedBefore) {
      applicationConditions.appliedAt = {};
      if (query.appliedAfter) {
        applicationConditions.appliedAt.gte = new Date(query.appliedAfter);
      }
      if (query.appliedBefore) {
        applicationConditions.appliedAt.lte = new Date(query.appliedBefore);
      }
      hasApplicationFilter = true;
    }

    if (hasApplicationFilter) {
      where.applications = {
        some: applicationConditions,
      };
    }

    // Pagination
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    // Sorting
    let orderBy: any = [{ createdAt: 'desc' }, { id: 'desc' }];
    if (query.sortBy === 'name') {
      orderBy = [{ name: query.sortOrder || 'asc' }, { id: 'asc' }];
    } else if (query.sortBy === 'createdAt') {
      orderBy = [{ createdAt: query.sortOrder || 'desc' }, { id: 'desc' }];
    }

    const [total, candidates] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          applications: {
            where: { organizationId },
            include: {
              job: {
                select: {
                  id: true,
                  jobCode: true,
                  title: true,
                  status: true,
                },
              },
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { appliedAt: 'desc' },
          },
          folderMemberships: {
            include: {
              folder: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          resumes: {
            select: {
              id: true,
              uploadedAt: true,
            },
          },
        },
      }),
    ]);

    const mappedCandidates: TalentPoolCandidateDto[] = candidates.map((c) => {
      const latestApp = c.applications[0];
      return {
        id: c.id,
        candidateCode: c.candidateCode,
        name: c.name,
        email: c.normalizedEmail,
        phone: c.phone,
        location: c.location,
        country: c.country,
        skills: c.skills,
        notes: c.notes,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        totalApplications: c.applications.length,
        lastAppliedAt: latestApp ? latestApp.appliedAt.toISOString() : null,
        lastStage: latestApp ? latestApp.stage : null,
        folders: c.folderMemberships.map((fm) => ({
          id: fm.folder.id,
          name: fm.folder.name,
        })),
        applications: c.applications.map((app) => ({
          id: app.id,
          jobId: app.jobId,
          jobCode: app.job.jobCode,
          jobTitle: app.job.title,
          clientId: app.clientId,
          clientName: app.client.name,
          stage: app.stage,
          source: app.source,
          appliedAt: app.appliedAt.toISOString(),
          recruiterNotes: app.recruiterNotes || undefined,
          clientFeedback: app.clientFeedback || undefined,
        })),
        resumeCount: c.resumes.length,
      };
    });

    const response: TalentPoolListResponse = {
      candidates: mappedCandidates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    talentPoolCache.set(cacheKey, {
      data: response,
      expiresAt: Date.now() + TALENT_POOL_CACHE_TTL_MS,
    });

    if (talentPoolCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of talentPoolCache.entries()) {
        if (v.expiresAt <= now) talentPoolCache.delete(k);
      }
    }

    return response;
  }

  /**
   * GET /api/talent-pool/candidates/:id
   * Retrieves single candidate with comprehensive applications, resumes, and folders.
   */
  static async getCandidate(user: AuthenticatedUser, candidateId: string) {
    const organizationId = this.validateRecruiterScope(user);

    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId,
      },
      include: {
        applications: {
          where: { organizationId },
          include: {
            job: {
              select: {
                id: true,
                jobCode: true,
                title: true,
                status: true,
              },
            },
            client: {
              select: {
                id: true,
                name: true,
              },
            },
            stageHistories: {
              orderBy: { timestamp: 'desc' },
              include: {
                actor: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
          orderBy: { appliedAt: 'desc' },
        },
        folderMemberships: {
          include: {
            folder: true,
          },
        },
        resumes: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            fileSize: true,
            parsingStatus: true,
            extractedText: true,
            uploadedAt: true,
          },
        },
      },
    });

    if (!candidate) {
      const err = new Error('Candidate not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    return {
      ...candidate,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      folders: candidate.folderMemberships.map((fm) => ({
        id: fm.folder.id,
        name: fm.folder.name,
      })),
      applications: candidate.applications.map((app) => ({
        ...app,
        appliedAt: app.appliedAt.toISOString(),
        stageHistories: app.stageHistories.map((sh) => ({
          ...sh,
          timestamp: sh.timestamp.toISOString(),
        })),
      })),
      resumes: candidate.resumes.map((r) => ({
        ...r,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
    };
  }

  /**
   * POST /api/talent-pool/candidates/:id/applications
   * Associates an existing talent pool candidate with a new job in the organization.
   * Creates an independent Application record without modifying other applications.
   */
  static async associateCandidateWithJob(
    user: AuthenticatedUser,
    candidateId: string,
    input: AssociateCandidateWithJobInput
  ) {
    const organizationId = this.validateRecruiterScope(user);

    // 1. Verify candidate belongs to caller's organization
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: candidateId,
        organizationId,
      },
    });

    if (!candidate) {
      const err = new Error('Candidate not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 2. Verify job belongs to caller's organization
    const job = await prisma.job.findFirst({
      where: {
        id: input.jobId,
        organizationId,
      },
    });

    if (!job) {
      const err = new Error('Target job not found in your organization');
      (err as any).statusCode = 404;
      (err as any).code = 'JOB_NOT_FOUND';
      throw err;
    }

    // 3. Check for existing application (idempotency constraint)
    const existingApplication = await prisma.application.findUnique({
      where: {
        jobId_candidateId: {
          jobId: job.id,
          candidateId: candidate.id,
        },
      },
      include: {
        job: true,
      },
    });

    if (existingApplication) {
      logger.info(
        { candidateId, jobId: job.id, applicationId: existingApplication.id },
        'Candidate already has an application for this job; returning existing record'
      );
      return {
        application: existingApplication,
        isExisting: true,
        message: `Candidate already applied to ${job.title} (${job.jobCode}) in stage "${existingApplication.stage}"`,
      };
    }

    // 4. Create new Application atomically with StageHistory and ActivityLog
    const result = await prisma.$transaction(async (tx) => {
      const newApp = await tx.application.create({
        data: {
          candidateId: candidate.id,
          jobId: job.id,
          organizationId,
          clientId: job.clientId,
          stage: ApplicationStage.APPLIED,
          source: input.source || 'talent_pool',
          recruiterNotes: input.recruiterNotes || null,
        },
        include: {
          job: {
            select: {
              id: true,
              jobCode: true,
              title: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Record initial StageHistory
      await tx.stageHistory.create({
        data: {
          applicationId: newApp.id,
          previousStage: 'None',
          nextStage: ApplicationStage.APPLIED,
          actorId: user.id || null,
          reason: 'Associated from Talent Pool',
        },
      });

      // Record ActivityLog
      await tx.activityLog.create({
        data: {
          organizationId,
          actorId: user.id || null,
          entityType: 'Application',
          entityId: newApp.id,
          action: 'CANDIDATE_ASSIGNED_TO_JOB',
          visibility: 'internal',
          details: {
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateCode: candidate.candidateCode,
            jobId: job.id,
            jobCode: job.jobCode,
            jobTitle: job.title,
          },
        },
      });

      return newApp;
    }, { timeout: 35000, maxWait: 15000 });

    logger.info(
      {
        candidateId: candidate.id,
        jobId: job.id,
        applicationId: result.id,
        actorId: user.id,
      },
      'Successfully associated candidate from talent pool with new job'
    );

    invalidateTalentPoolCache(organizationId);

    return {
      application: result,
      isExisting: false,
      message: `Candidate successfully assigned to ${job.title} (${job.jobCode})`,
    };
  }

  // ==========================================================================
  // Talent Pool Folder Operations
  // ==========================================================================

  /**
   * GET /api/talent-pool/folders
   * Lists all organization-private folders with real candidate counts.
   */
  static async listFolders(user: AuthenticatedUser): Promise<TalentPoolFolderDto[]> {
    const organizationId = this.validateRecruiterScope(user);

    const cacheKey = `tp:folders:${organizationId}`;
    const cached = talentPoolCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const folders = await prisma.talentPoolFolder.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    const folderDtos = folders.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      candidateCount: f._count.members,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    talentPoolCache.set(cacheKey, {
      data: folderDtos,
      expiresAt: Date.now() + 60 * 1000,
    });

    return folderDtos;
  }

  /**
   * POST /api/talent-pool/folders
   * Creates a new organization-scoped folder with uniqueness enforcement.
   */
  static async createFolder(
    user: AuthenticatedUser,
    input: CreateTalentPoolFolderInput
  ): Promise<TalentPoolFolderDto> {
    const organizationId = this.validateRecruiterScope(user);

    // Check duplicate name within organization
    const existing = await prisma.talentPoolFolder.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name: input.name,
        },
      },
    });

    if (existing) {
      const err = new Error(`Folder "${input.name}" already exists in your organization`);
      (err as any).statusCode = 409;
      (err as any).code = 'FOLDER_EXISTS';
      throw err;
    }

    const folder = await prisma.talentPoolFolder.create({
      data: {
        organizationId,
        name: input.name,
        description: input.description || null,
      },
    });

    invalidateTalentPoolCache(organizationId);

    return {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      candidateCount: 0,
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }

  /**
   * PATCH /api/talent-pool/folders/:id
   * Updates folder name and/or description within tenant boundaries.
   */
  static async updateFolder(
    user: AuthenticatedUser,
    folderId: string,
    input: UpdateTalentPoolFolderInput
  ): Promise<TalentPoolFolderDto> {
    const organizationId = this.validateRecruiterScope(user);

    const folder = await prisma.talentPoolFolder.findFirst({
      where: { id: folderId, organizationId },
    });

    if (!folder) {
      const err = new Error('Folder not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Check uniqueness if name is updated
    if (input.name && input.name !== folder.name) {
      const existing = await prisma.talentPoolFolder.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name: input.name,
          },
        },
      });

      if (existing) {
        const err = new Error(`Folder "${input.name}" already exists in your organization`);
        (err as any).statusCode = 409;
        (err as any).code = 'FOLDER_EXISTS';
        throw err;
      }
    }

    const updated = await prisma.talentPoolFolder.update({
      where: { id: folderId },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    invalidateTalentPoolCache(organizationId);

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      candidateCount: updated._count.members,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * DELETE /api/talent-pool/folders/:id
   * Deletes folder and memberships. Underlying candidates and applications remain untouched.
   */
  static async deleteFolder(user: AuthenticatedUser, folderId: string): Promise<{ success: boolean }> {
    const organizationId = this.validateRecruiterScope(user);

    const folder = await prisma.talentPoolFolder.findFirst({
      where: { id: folderId, organizationId },
    });

    if (!folder) {
      const err = new Error('Folder not found');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    await prisma.talentPoolFolder.delete({
      where: { id: folderId },
    });

    invalidateTalentPoolCache(organizationId);

    return { success: true };
  }

  /**
   * POST /api/talent-pool/folders/:id/candidates
   * Adds an existing candidate to a folder after verifying organization scope.
   */
  static async addCandidateToFolder(
    user: AuthenticatedUser,
    folderId: string,
    candidateId: string
  ): Promise<{ success: boolean; message: string }> {
    const organizationId = this.validateRecruiterScope(user);

    // 1. Verify folder belongs to organization
    const folder = await prisma.talentPoolFolder.findFirst({
      where: { id: folderId, organizationId },
    });

    if (!folder) {
      const err = new Error('Folder not found in your organization');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 2. Verify candidate belongs to organization
    const candidate = await prisma.candidate.findFirst({
      where: { id: candidateId, organizationId },
    });

    if (!candidate) {
      const err = new Error('Candidate not found in your organization');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // 3. Upsert folder membership (idempotent)
    await prisma.talentPoolFolderMember.upsert({
      where: {
        folderId_candidateId: {
          folderId,
          candidateId,
        },
      },
      create: {
        folderId,
        candidateId,
      },
      update: {},
    });

    invalidateTalentPoolCache(organizationId);

    return {
      success: true,
      message: `Candidate ${candidate.name} added to folder "${folder.name}"`,
    };
  }

  /**
   * DELETE /api/talent-pool/folders/:id/candidates/:candidateId
   * Removes folder membership. Candidate record remains completely intact.
   */
  static async removeCandidateFromFolder(
    user: AuthenticatedUser,
    folderId: string,
    candidateId: string
  ): Promise<{ success: boolean; message: string }> {
    const organizationId = this.validateRecruiterScope(user);

    // Verify folder belongs to organization
    const folder = await prisma.talentPoolFolder.findFirst({
      where: { id: folderId, organizationId },
    });

    if (!folder) {
      const err = new Error('Folder not found in your organization');
      (err as any).statusCode = 404;
      (err as any).code = 'NOT_FOUND';
      throw err;
    }

    // Delete membership if exists
    await prisma.talentPoolFolderMember.deleteMany({
      where: {
        folderId,
        candidateId,
      },
    });

    invalidateTalentPoolCache(organizationId);

    return {
      success: true,
      message: `Candidate removed from folder "${folder.name}"`,
    };
  }
}
