import { CreateJobInput, UpdateJobInput, JobQueryInput, PublicJobDto } from '@hiredesk/shared';

export interface ApiJob {
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
  status: 'draft' | 'published' | 'closed';
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

export interface ClientOption {
  id: string;
  name: string;
  status: string;
}

export async function fetchJobs(
  token: string,
  query?: Partial<JobQueryInput>
): Promise<{ jobs: ApiJob[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.search) params.set('search', query.search);
  if (query?.clientId) params.set('clientId', query.clientId);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch jobs');
  }

  return {
    jobs: json.data,
    total: json.meta?.total || json.data.length,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 20,
  };
}

export async function fetchJobById(token: string, id: string): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch job');
  }
  return json.data;
}

export async function createJob(token: string, input: CreateJobInput): Promise<ApiJob> {
  const res = await fetch('/api/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to create job');
  }
  return json.data;
}

export async function updateJob(token: string, id: string, input: UpdateJobInput): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to update job');
  }
  return json.data;
}

export async function publishJob(token: string, id: string): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to publish job');
  }
  return json.data;
}

export async function closeJob(token: string, id: string): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to close job');
  }
  return json.data;
}

export async function reopenJob(token: string, id: string): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}/reopen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to reopen job');
  }
  return json.data;
}

export async function duplicateJob(token: string, id: string): Promise<ApiJob> {
  const res = await fetch(`/api/jobs/${id}/duplicate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to duplicate job');
  }
  return json.data;
}

export async function fetchClientsForOrg(token: string, orgId: string): Promise<ClientOption[]> {
  const res = await fetch(`/api/admin/organizations/${orgId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    return [];
  }
  return json.data.clients || [];
}

export async function fetchPublicCareerJobs(orgSlug: string): Promise<{ organization: { name: string; slug: string }; jobs: PublicJobDto[] }> {
  const res = await fetch(`/api/career/${orgSlug}/jobs`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to load career page');
  }
  return json.data;
}

export async function fetchPublicCareerJobByCode(orgSlug: string, jobCode: string): Promise<PublicJobDto> {
  const res = await fetch(`/api/career/${orgSlug}/jobs/${jobCode}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Job vacancy not found');
  }
  return json.data;
}

export interface PublicApplyResult {
  applicationId: string;
  candidateCode: string;
  status: string;
  message: string;
  isDuplicate?: boolean;
}

export async function submitPublicApplication(
  orgSlug: string,
  jobCode: string,
  formData: FormData
): Promise<PublicApplyResult> {
  const res = await fetch(`/api/career/${orgSlug}/jobs/${jobCode}/applications`, {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to submit application');
  }
  return json.data;
}

export interface ApplicationItem {
  id: string;
  candidateId: string;
  jobId: string;
  stage: string;
  source: string;
  appliedAt: string;
  status: string;
  candidate: {
    id: string;
    candidateCode: string;
    name: string;
    email: string;
    phone?: string | null;
    location?: string | null;
  };
  resumes: Array<{
    id: string;
    originalFilename: string;
    fileSize: number;
    contentType: string;
    uploadedAt: string;
  }>;
}

export async function fetchJobApplications(
  token: string,
  jobId: string
): Promise<{ applications: ApplicationItem[]; total: number }> {
  const res = await fetch(`/api/jobs/${jobId}/applications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch applications');
  }
  return {
    applications: json.data,
    total: json.meta?.total || json.data.length,
  };
}

export async function fetchResumeDownloadUrl(
  token: string,
  applicationId: string
): Promise<{ signedUrl: string; filename: string }> {
  const res = await fetch(`/api/applications/${applicationId}/resume`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch resume download URL');
  }
  return json.data;
}

