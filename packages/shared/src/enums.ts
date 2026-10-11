export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  MANAGER = 'manager',
  RECRUITER = 'recruiter',
  CLIENT = 'client',
}

export enum JobStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CLOSED = 'closed',
}

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
}

export enum WorkplaceModel {
  REMOTE = 'remote',
  ON_SITE = 'on_site',
  HYBRID = 'hybrid',
}

export enum ApplicationStage {
  APPLIED = 'Applied',
  SCREENING = 'Screening',
  SHORTLISTED = 'Shortlisted',
  INTERVIEW = 'Interview',
  AI_INTERVIEW = 'AI Interview',
  CLIENT_REVIEW = 'Client Review',
  SELECTED = 'Selected',
  HIRED = 'Hired',
  REJECTED = 'Rejected',
  WITHDRAWN = 'Withdrawn',
}

export enum InboundStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  MATCHED = 'matched',
  UNMATCHED = 'unmatched',
  FAILED = 'failed',
  RETRYING = 'retrying',
  MANUALLY_ASSIGNED = 'manually_assigned',
  IGNORED = 'ignored',
  DUPLICATE = 'duplicate',
}

export enum InterviewRequestStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
