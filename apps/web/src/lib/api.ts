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

// ============================================================================
// Phase 5: Dashboard Analytics, Pipeline & Candidate Profile
// ============================================================================

export interface DashboardMetrics {
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
    actor?: {
      id: string;
      fullName: string;
      role: string;
    } | null;
  }>;
}

export interface PipelineApplication {
  id: string;
  candidateId: string;
  jobId: string;
  stage: string;
  source: string;
  appliedAt: string;
  clientFeedback?: string | null;
  recruiterNotes?: string | null;
  candidate: {
    id: string;
    candidateCode: string;
    name: string;
    normalizedEmail: string;
    phone?: string | null;
    location?: string | null;
    skills?: string[];
  };
  resumes: Array<{
    id: string;
    originalFilename: string;
    fileSize: number;
    contentType: string;
    uploadedAt: string;
  }>;
  lastStageChange?: {
    timestamp: string;
    reason?: string | null;
  } | null;
  interviewRequests?: Array<{
    id: string;
    status: string;
    preferredTimes?: string[];
    notes?: string | null;
    createdAt: string;
  }>;
  hasPendingInterviewRequest?: boolean;
}

export interface JobPipeline {
  job: {
    id: string;
    jobCode: string;
    title: string;
    status: string;
    client?: { id: string; name: string } | null;
  };
  stages: Record<string, PipelineApplication[]>;
  counts: Record<string, number>;
  totalApplications: number;
}

export interface CandidateProfile {
  id: string;
  candidateCode: string;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  country?: string | null;
  skills: string[];
  education: any;
  experience: any;
  createdAt: string;
  updatedAt: string;
  applications: Array<{
    id: string;
    jobId: string;
    stage: string;
    source: string;
    appliedAt: string;
    clientFeedback?: string | null;
    recruiterNotes?: string | null;
    job: {
      id: string;
      jobCode: string;
      title: string;
      status: string;
      clientId: string;
      client?: { name: string } | null;
    };
    resumes: Array<{
      id: string;
      originalFilename: string;
      fileSize: number;
    }>;
    lastStageChange?: {
      id: string;
      previousStage: string;
      nextStage: string;
      timestamp: string;
      reason?: string | null;
    } | null;
  }>;
  resumes: Array<{
    id: string;
    originalFilename: string;
    fileSize: number;
    contentType: string;
    uploadedAt: string;
  }>;
}

export async function fetchDashboardAnalytics(
  token: string,
  organizationId?: string
): Promise<DashboardMetrics> {
  const url = organizationId ? `/api/analytics/dashboard?organizationId=${organizationId}` : '/api/analytics/dashboard';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch dashboard metrics');
  }
  return json.data;
}

export async function fetchJobPipeline(token: string, jobId: string): Promise<JobPipeline> {
  const res = await fetch(`/api/jobs/${jobId}/pipeline`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch job pipeline');
  }
  return json.data;
}

export async function transitionApplicationStage(
  token: string,
  applicationId: string,
  stage: string,
  reason?: string
): Promise<any> {
  const res = await fetch(`/api/applications/${applicationId}/stage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ stage, reason }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to transition application stage');
  }
  return json.data;
}

export async function updateApplicationNotes(
  token: string,
  applicationId: string,
  input: { recruiterNotes?: string; clientFeedback?: string }
): Promise<any> {
  const res = await fetch(`/api/applications/${applicationId}/notes`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to update application notes');
  }
  return json.data;
}

export async function fetchCandidateProfile(token: string, candidateId: string): Promise<CandidateProfile> {
  const res = await fetch(`/api/candidates/${candidateId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch candidate profile');
  }
  return json.data;
}

export async function fetchCandidates(
  token: string,
  query?: { search?: string; page?: number; limit?: number }
): Promise<{ candidates: any[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/candidates?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch candidates');
  }
  return {
    candidates: json.data,
    total: json.meta?.total || json.data.length,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 20,
  };
}

// ============================================================================
// Phase 6: Client Portal API Client Methods
// ============================================================================

export interface ClientPortalMe {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string | null;
    role: string;
    organizationId: string;
    organizationName: string | null;
    clientId: string;
    clientName: string | null;
  };
  client: {
    id: string;
    name: string;
    contactEmail: string;
    status: string;
  };
}

export interface ClientPortalJob {
  id: string;
  jobCode: string;
  title: string;
  department: string | null;
  employmentType: string;
  workplaceModel: string;
  country: string;
  currency: string;
  salaryMin: number | null;
  salaryMax: number | null;
  openings: number;
  deadline: string | null;
  status: string;
  description: string;
  requirements: string | null;
  skills: string[];
  applicantCount: number;
  reviewCount: number;
  shortlistedCount: number;
  createdAt: string;
}

export interface ClientPortalApplication {
  id: string;
  candidateId: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  stage: string;
  appliedAt: string;
  status: string;
  candidate: {
    id: string;
    candidateCode: string;
    name: string;
    email: string;
    phone?: string | null;
    location?: string | null;
    skills: string[];
    education?: any;
    experience?: any;
  };
  answers: Record<string, any>;
  clientFeedback?: string | null;
  resumes: Array<{
    id: string;
    originalFilename: string;
    fileSize: number;
    contentType: string;
    uploadedAt: string;
  }>;
  stageHistories: Array<{
    id: string;
    previousStage: string;
    nextStage: string;
    reason?: string | null;
    timestamp: string;
  }>;
  interviewRequests: Array<{
    id: string;
    status: string;
    preferredTimes: string[];
    notes?: string | null;
    createdAt: string;
  }>;
}

export async function fetchClientProfile(token: string): Promise<ClientPortalMe> {
  const res = await fetch('/api/client-portal/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch client profile');
  }
  return json.data;
}

export async function fetchClientJobs(
  token: string,
  query?: { search?: string; page?: number; limit?: number }
): Promise<{ jobs: ClientPortalJob[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/client-portal/jobs?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch client jobs');
  }
  return {
    jobs: json.data,
    total: json.meta?.total || json.data.length,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 20,
  };
}

export async function fetchClientJobApplications(
  token: string,
  jobId: string,
  query?: { stage?: string; search?: string; page?: number; limit?: number }
): Promise<{
  applications: ClientPortalApplication[];
  total: number;
  page: number;
  limit: number;
  job: { id: string; jobCode: string; title: string };
}> {
  const params = new URLSearchParams();
  if (query?.stage) params.set('stage', query.stage);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/client-portal/jobs/${jobId}/applications?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch job applications');
  }
  return {
    applications: json.data,
    total: json.meta?.total || json.data.length,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 20,
    job: json.meta?.job || { id: jobId, jobCode: '', title: '' },
  };
}

export async function fetchClientApplication(token: string, applicationId: string): Promise<ClientPortalApplication> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch application');
  }
  return json.data;
}

export async function fetchClientResumeUrl(
  token: string,
  applicationId: string
): Promise<{ signedUrl: string; filename: string; expiresIn: number }> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}/resume`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to generate resume download link');
  }
  return json.data;
}

export async function clientShortlistCandidate(
  token: string,
  applicationId: string,
  notes?: string
): Promise<ClientPortalApplication> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}/shortlist`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to shortlist candidate');
  }
  return json.data;
}

export async function clientRejectCandidate(
  token: string,
  applicationId: string,
  reason: string
): Promise<ClientPortalApplication> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to reject candidate');
  }
  return json.data;
}

export async function clientRequestInterview(
  token: string,
  applicationId: string,
  preferredTimes: string[],
  notes?: string
): Promise<{ id: string; status: string; message: string; preferredTimes: string[]; notes?: string | null }> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}/request-interview`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preferredTimes, notes }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to request interview');
  }
  return json.data;
}

export async function clientSubmitFeedback(
  token: string,
  applicationId: string,
  feedback: string
): Promise<ClientPortalApplication> {
  const res = await fetch(`/api/client-portal/applications/${applicationId}/feedback`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ feedback }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to submit feedback');
  }
  return json.data;
}

// ============================================================================
// Phase 7: Interview Scheduling & Outbox Communication API
// ============================================================================

export interface ApiInterviewCommunication {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  recipientType: string;
  templateId: string;
  subject: string;
  status: 'queued' | 'sending' | 'sent' | 'failed' | string;
  providerMessageId: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface ApiInterviewHistory {
  id: string;
  previousStatus: string;
  nextStatus: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  actor?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
  } | null;
}

export interface ApiInterview {
  id: string;
  organizationId: string;
  clientId: string;
  jobId: string;
  applicationId: string;
  candidateId: string;
  interviewerUserProfileId: string;
  scheduledByUserProfileId: string | null;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled' | string;
  startAt: string;
  endAt: string;
  timeZone: string;
  meetingProvider: string | null;
  meetingUrl: string | null;
  location: string | null;
  sequence: number;
  interviewerNotes?: string | null;
  feedback: string | null;
  result: string | null;
  cancellationReason: string | null;
  candidate: {
    id: string;
    name: string;
    normalizedEmail?: string;
    candidateCode: string;
  };
  job: {
    id: string;
    jobCode: string;
    title: string;
  };
  client: {
    id: string;
    name: string;
  };
  interviewer: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email?: string;
  };
  scheduledBy?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
  } | null;
  communications?: ApiInterviewCommunication[];
  histories?: ApiInterviewHistory[];
  createdAt: string;
  updatedAt?: string;
}

export interface ApiInterviewerOption {
  id: string;
  fullName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export interface ApiPendingInterviewRequest {
  id: string;
  applicationId: string;
  jobId: string;
  clientId: string;
  status: string;
  preferredTimes: string[];
  notes: string | null;
  createdAt: string;
  application: {
    id: string;
    candidate: {
      id: string;
      name: string;
      normalizedEmail: string;
      candidateCode: string;
    };
  };
  job: {
    id: string;
    jobCode: string;
    title: string;
  };
  client: {
    id: string;
    name: string;
  };
  requestedBy?: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
  } | null;
}

export async function fetchInterviews(
  token: string,
  query?: {
    status?: string;
    jobId?: string;
    clientId?: string;
    candidateId?: string;
    interviewerId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): Promise<{ interviews: ApiInterview[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.jobId) params.set('jobId', query.jobId);
  if (query?.clientId) params.set('clientId', query.clientId);
  if (query?.candidateId) params.set('candidateId', query.candidateId);
  if (query?.interviewerId) params.set('interviewerId', query.interviewerId);
  if (query?.startDate) params.set('startDate', query.startDate);
  if (query?.endDate) params.set('endDate', query.endDate);
  if (query?.search) params.set('search', query.search);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/interviews?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch interviews');
  }
  return {
    interviews: json.data,
    total: json.meta?.total || 0,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 50,
  };
}

export async function fetchInterview(token: string, id: string): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch interview');
  }
  return json.data;
}

export async function scheduleInterview(
  token: string,
  payload: {
    applicationId: string;
    jobId: string;
    candidateId: string;
    clientId: string;
    interviewerUserProfileId: string;
    interviewRequestId?: string | null;
    type: string;
    startAt: string;
    endAt: string;
    timeZone: string;
    meetingProvider?: string | null;
    meetingUrl?: string | null;
    location?: string | null;
    interviewerNotes?: string | null;
  }
): Promise<ApiInterview> {
  const res = await fetch('/api/interviews', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to schedule interview');
  }
  return json.data;
}

export async function rescheduleInterview(
  token: string,
  id: string,
  payload: {
    startAt: string;
    endAt: string;
    timeZone: string;
    meetingProvider?: string | null;
    meetingUrl?: string | null;
    location?: string | null;
    reason?: string | null;
    interviewerNotes?: string | null;
  }
): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}/reschedule`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to reschedule interview');
  }
  return json.data;
}

export async function cancelInterview(
  token: string,
  id: string,
  reason: string
): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}/cancel`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to cancel interview');
  }
  return json.data;
}

export async function completeInterview(
  token: string,
  id: string,
  payload: {
    feedback?: string | null;
    result?: string | null;
    interviewerNotes?: string | null;
  }
): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}/complete`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to complete interview');
  }
  return json.data;
}

export async function recordNoShow(
  token: string,
  id: string,
  notes?: string
): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}/no-show`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notes }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to record no-show');
  }
  return json.data;
}

export async function updateInterviewFeedback(
  token: string,
  id: string,
  payload: { feedback: string; result?: string | null }
): Promise<ApiInterview> {
  const res = await fetch(`/api/interviews/${id}/feedback`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to update interview feedback');
  }
  return json.data;
}

export async function retryOutboundCommunication(
  token: string,
  interviewId: string,
  commId: string
): Promise<{ retried: boolean; success: boolean }> {
  const res = await fetch(`/api/interviews/${interviewId}/communications/${commId}/retry`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to retry email delivery');
  }
  return json.data;
}

export async function fetchInterviewers(token: string): Promise<ApiInterviewerOption[]> {
  const res = await fetch('/api/interviews/metadata/interviewers', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch interviewers');
  }
  return json.data;
}

export async function fetchPendingInterviewRequests(token: string): Promise<ApiPendingInterviewRequest[]> {
  const res = await fetch('/api/interviews/metadata/pending-requests', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch pending interview requests');
  }
  return json.data;
}

export async function fetchClientScheduledInterviews(
  token: string,
  query?: { status?: string; jobId?: string; page?: number; limit?: number }
): Promise<{ interviews: ApiInterview[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.jobId) params.set('jobId', query.jobId);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await fetch(`/api/client-portal/interviews?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch client scheduled interviews');
  }
  return {
    interviews: json.data,
    total: json.meta?.total || 0,
    page: json.meta?.page || 1,
    limit: json.meta?.limit || 50,
  };
}

export async function fetchClientScheduledInterview(token: string, id: string): Promise<ApiInterview> {
  const res = await fetch(`/api/client-portal/interviews/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || 'Failed to fetch interview details');
  }
  return json.data;
}

