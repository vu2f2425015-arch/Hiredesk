# HiredeskHR — Implementation Plan & Phase Tracking

## Overview
This document tracks the phased implementation of HiredeskHR. Each phase must be verified with automated checks and tests before proceeding to subsequent phases.

---

## Phase Roadmap & Status

### [COMPLETED] Phase 0 — Monorepo Scaffold & Standards
- [x] Create project documentation (`PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SECURITY_MODEL.md`, `IMPLEMENTATION_PLAN.md`, `ACCEPTANCE_TESTS.md`, `DECISIONS.md`).
- [x] Initialize Git repository and `.gitignore`.
- [x] Create root `package.json` with npm workspaces (`apps/*`, `packages/*`).
- [x] Configure root TypeScript and workspace `tsconfig.json` files.
- [x] Implement `packages/shared` with core TypeScript enums (`UserRole`, `JobStatus`, `ApplicationStage`, `InboundStatus`) and shared Zod schemas.
- [x] Implement `packages/database` with Prisma schema for core entities.
- [x] Implement `apps/api` with Express + TypeScript:
  - [x] Correlation ID middleware (`x-request-id`).
  - [x] Security middleware (Helmet, CORS).
  - [x] Structured logger (Pino with PII redaction).
  - [x] Standardized error handler and response envelope.
  - [x] `/health` endpoint returning system status, timestamp, uptime, and version.
  - [x] Unit/Integration tests for `/health` with Vitest and Supertest.
- [x] Implement `apps/worker` with TypeScript:
  - [x] Worker lifecycle runner with graceful shutdown handlers.
  - [x] Pure `jobCodeExtractor` supporting dash variants, case insensitivity, and body fallbacks.
  - [x] Unit test suite covering 9 normalization and edge-case scenarios.
- [x] Implement `apps/web` with React + Vite + TypeScript:
  - [x] Responsive web shell with modern design tokens and theme.
  - [x] React Router navigation for implemented views.
  - [x] Live system diagnostic inspection querying `/api/health`.
  - [x] Honest empty states and navigation skeleton without fake data.
- [x] Create `.env.example` with documented configuration templates.
- [x] Create root `README.md` with setup instructions.
- [x] Run lint, type-check, and tests across all workspaces.

---

### [COMPLETED] Phase 1 — Supabase Auth, Profiles & Tenant Authorization
- [x] Supabase Auth client integration in `apps/web` (login, logout, session restoration, missing credentials detection).
- [x] Express JWT verification middleware in `apps/api` (`authenticate`, `requireRole`, `requireTenant`).
- [x] Refined `UserProfile` model in Prisma with `authUserId` (unique), `fullName`, `isActive`, and organization/client relations.
- [x] Protected onboarding and bootstrap endpoint (`POST /api/bootstrap/super-admin`) requiring `BOOTSTRAP_SECRET` and locking permanently after the first super-admin.
- [x] Dedicated CLI bootstrap script (`packages/database/src/scripts/bootstrapAdmin.ts`).
- [x] Administrative tenant provisioning endpoints (`POST /api/admin/organizations`, `POST /api/admin/clients`, `POST /api/admin/users`).
- [x] Anti-privilege-escalation rules (managers cannot create super-admin; client users cannot access provisioning).
- [x] Test matrix covering 14 automated unit/API test scenarios (unauthenticated 401, expired token 401, disabled user 403, missing profile 403, cross-tenant isolation 403, cross-client isolation 403, privilege escalation prevention, and locked bootstrap).

---

### [COMPLETED] Phase 2 — Jobs & Atomic Global Job Codes
- [x] PostgreSQL atomic sequence (`job_code_seq`) and database migration for `JOB-1001` format.
- [x] Versioned migration (`packages/database/prisma/migrations/20261011000000_init_jobs_sequence_triggers/migration.sql`) and Supabase migration (`supabase/migrations/`).
- [x] Trigger function `enforce_job_code_immutability()` protecting `jobCode` from post-creation tampering.
- [x] Job CRUD endpoints in `apps/api` (`POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:id`, `PATCH /api/jobs/:id`, `POST /api/jobs/:id/publish`, `POST /api/jobs/:id/close`, `POST /api/jobs/:id/reopen`, `POST /api/jobs/:id/duplicate`).
- [x] Zod validation schemas (`CreateJobSchema`, `UpdateJobSchema`, `JobQuerySchema`, `PublicJobDtoSchema`).
- [x] Strict tenant & client authorization (recruiters locked to their agency org; clients restricted to their own published jobs).
- [x] Public career endpoints (`GET /api/career/:orgSlug/jobs`, `GET /api/career/:orgSlug/jobs/:jobCode`) returning only published jobs and stripping internal metadata.
- [x] Frontend Jobs UI in `apps/web` with live search, status filters, Create Job modal with client-side validation, one-click Job Code copy, and detailed drawer view.
- [x] Frontend Public Career view (`/career/:orgSlug` and `/career/:orgSlug/:jobCode`).
- [x] Concurrency and immutability test suite with 13 automated tests covering race conditions, client isolation, and duplication.

---

### [COMPLETED] Phase 3 — Candidate, Application & Public Career Portal
- [x] Prisma schema migrations for `Candidate`, `Application`, `Resume`, and `StageHistory`.
- [x] Candidate deduplication by `(organizationId, normalizedEmail)` with conservative trimming and lowercasing.
- [x] Atomic candidate code allocation (`CAND-1001` upwards) querying PostgreSQL sequence `candidate_code_seq`.
- [x] Application idempotency strategy on `(jobId, candidateId)` preventing duplicate rows or storage waste on retries.
- [x] Public application submission API (`POST /api/career/:orgSlug/jobs/:jobCode/applications` and `/apply`) with multipart resume file upload.
- [x] Strict server-side file upload validation (PDF/DOCX/DOC, magic bytes inspection, 10 MB limit, filename sanitization).
- [x] Private Supabase Storage integration in bucket `resumes` with partial failure rollback handling (deleting orphaned files if database fails).
- [x] Honeypot spam trap detection and rate limiting (20 requests / 15 minutes per IP).
- [x] Public career page apply form in `apps/web` with responsive UX, client validation, honest upload states, and confirmation card.
- [x] Recruiter applicant pipeline in `JobsView` drawer displaying real applications, candidate codes, and 60-second signed resume download URLs.
- [x] Authorized recruiter/client endpoints (`GET /api/jobs/:jobId/applications`, `GET /api/applications/:id`, `GET /api/applications/:id/resume`) with strict tenant and client boundaries.
- [x] Comprehensive test suite in `apps/api/tests/applications.test.ts` (19 automated tests) covering all 29 verification criteria.

---

### [COMPLETED] Phase 4 — Inbound Email Ingestion, Job Code Matching, Retry Safety & Unmatched Applications
- [x] Versioned Prisma migration `20261011000002_inbound_fields` adding `matchedClientId`, `lastAttemptAt`, `rawPayload`, and indexes to `inbound_applications`.
- [x] Pure Job Code extractor in `apps/worker/src/jobCodeExtractor.ts` with subject-first, body-fallback, HTML-fallback, and entity decoding.
- [x] PyjamaHR email parser in `apps/worker/src/emailParser.ts` using `mailparser` extracting candidate name, email, phone, location, and attachments.
- [x] Storage service in `apps/worker/src/storage.ts` enforcing magic bytes validation (PDF, DOC, DOCX), 10 MB limit, and private Supabase Storage upload.
- [x] Concurrency-safe, atomic lease state machine in `apps/worker/src/inboundProcessor.ts` (`received -> processing -> matched | unmatched | duplicate | failed | ignored`).
- [x] Candidate deduplication by `(organizationId, normalizedEmail)` and application idempotency on `(jobId, candidateId)` (marks `duplicate` without duplicate rows or redundant storage uploads).
- [x] Compensating transaction rollback: deletes uploaded resume storage object if database write fails, preventing orphaned files.
- [x] IMAP worker daemon in `apps/worker/src/imapClient.ts` with non-overlapping polling cycles, bounded backoff, graceful shutdown, and pluggable `MailboxFetcher` interface.
- [x] Unmatched applications management API in `apps/api/src/routes/inbound.ts` (`GET /api/admin/inbound-applications`, `GET /api/admin/inbound-applications/:id`, `POST /api/admin/inbound-applications/:id/assign`, `POST /api/admin/inbound-applications/:id/retry`, `POST /api/admin/inbound-applications/:id/ignore`).
- [x] Unmatched Queue web UI in `apps/web/src/pages/UnmatchedApplicationsView.tsx` with status filter tabs, search, manual job assignment modal, and ignore modal.
- [x] Sanitized test email RFC822 fixture in `apps/worker/fixtures/sample_application_email.eml`.
- [x] 88 automated unit/API/worker tests passing across all packages; live Supabase database and storage end-to-end verified with `test_inbound_e2e.mjs`.

---

### [COMPLETED] Phase 5 — Recruiter Dashboard, Candidate Profile, Pipeline Progression & Activity History
- [x] Versioned Prisma migration `20261011000003_activity_visibility` adding `visibility` column and `(organizationId, visibility)` composite index to `activity_logs`. Applied to live Supabase DB.
- [x] Shared Zod contracts in `packages/shared/src/schemas/analytics.ts` and `candidate.ts` (`DashboardMetricsDto`, `DashboardAnalyticsQuerySchema`, `CandidateQuerySchema`, `StageTransitionSchema`, `UpdateNotesSchema`).
- [x] Live database-derived metrics API in `apps/api/src/services/analytics.ts` and `apps/api/src/routes/analytics.ts` (`GET /api/analytics/dashboard`):
  - Total jobs, active/published, drafts, closed.
  - Total unique candidates in permitted tenant scope.
  - New applications within UTC 7-day window.
  - Canonical stage counts (`Applied`, `Screening`, `Shortlisted`, `Interview`, `AI Interview`, `Client Review`, `Selected`, `Hired`, `Rejected`, `Withdrawn`).
  - Jobs approaching application deadline within 14 days.
  - Recent activity timeline with tenant/role-based visibility filtering.
  - Honest zeros for empty organizations (zero fake sample data).
- [x] Atomic stage transition service in `apps/api/src/services/applications.ts` (`POST /api/applications/:id/stage`):
  - Executes `Application.stage`, `StageHistory`, and `ActivityLog` write inside a single PostgreSQL `$transaction`.
  - Actor ID verified against `UserProfile` table with foreign key safety.
  - Client users strictly restricted from making recruiter-only stage changes (only allowed when application is currently in `Client Review`).
- [x] Hard separation of recruiter notes vs client feedback (`PATCH /api/applications/:id/notes`):
  - Recruiter notes are completely redacted (`undefined`) in all client responses.
  - Client attempts to mutate `recruiterNotes` immediately rejected with `403 Forbidden`.
  - Recruiter updates to notes create internal activity logs; client feedback creates client-visible activity logs.
- [x] Candidate talent profile and multi-job application view (`GET /api/candidates/:id`, `GET /api/candidates`):
  - Independent stage tracking across different job applications for the same candidate.
  - Authorized private resume access with time-limited signed URLs or streams.
- [x] Frontend Recruiter UI in `apps/web`:
  - `DashboardView.tsx`: Real KPI cards, stage breakdown bars, deadline alerts (clickable navigation), and activity feed.
  - `JobPipelineView.tsx`: Kanban pipeline with stage columns, count pills, candidate cards, accessible dropdown stage changers, and resume download.
  - `CandidateProfileModal.tsx`: Comprehensive candidate details, multi-job application selector, stage transition controls, separated "Internal Recruiter Notes" (locked from clients) vs "Client Feedback" editors, and resume download.
  - Connected into `App.tsx` navigation and `JobsView.tsx` quick actions.
- [x] Comprehensive test coverage:
  - 106 automated Vitest tests passing across all workspaces (78 API, 25 Worker, 3 Shared).
  - 18 dedicated Phase 5 tests in `analytics.test.ts` (5 tests) and `pipeline.test.ts` (13 tests).
  - Live Supabase PostgreSQL and Storage verified end-to-end via `test_phase5_e2e.mjs`.

---

### [COMPLETED] Phase 6 — Dedicated Client Portal, Client Review Actions & Tenant Isolation Hardening
- [x] Dedicated Client Portal API and routes in `apps/api/src/routes/clientPortal.ts` mounted at `/api/client-portal/*`.
- [x] Client role authorization enforcement (`validateClientScope`) strictly locking client access to authenticated `organizationId` and `clientId`.
- [x] Safe Client DTO architecture:
  - Redacts `recruiterNotes` (`undefined`).
  - Redacts private `storagePath`, `bucket`, `checksum`, and `parsingError` on resumes.
  - Strips raw email payloads, internal activity logs, and cross-client telemetry.
- [x] Non-disclosing 404 Not Found for any cross-tenant, cross-client, or non-existent entity access attempts.
- [x] Persisted `InterviewRequest` entity in PostgreSQL (`packages/database/prisma/schema.prisma` and versioned migration `20261011000004_interview_requests`):
  - Correctly records auditable client interview requests with `status: 'pending'`.
  - Honest distinction: Does NOT simulate or pretend a calendar invite or scheduled meeting was sent. Returns explicit notice: *"Interview request submitted. Your recruiter will coordinate scheduling."*
- [x] Client review action endpoints:
  - `POST /api/client-portal/applications/:id/shortlist`: Idempotent transition from `Client Review` to `Shortlisted` with atomic `StageHistory` and `ActivityLog`.
  - `POST /api/client-portal/applications/:id/reject`: Requires validated reason, transitions to `Rejected` with atomic audit logging.
  - `POST /api/client-portal/applications/:id/request-interview`: Idempotent pending request creation.
  - `POST /api/client-portal/applications/:id/feedback`: Adds `clientFeedback` without modifying or leaking `recruiterNotes`.
  - `GET /api/client-portal/applications/:id/resume`: Issues authorized, short-lived 60-second signed URL for client resume preview.
- [x] Frontend Client Portal in `apps/web/src/pages/ClientPortalView.tsx`:
  - Client company banner, live KPIs (assigned jobs, total applicants, review queue, shortlisted).
  - Searchable jobs directory with applicant counts.
  - Applicant list filtered by pipeline stage.
  - Modal candidate review drawer with resume download, feedback history, and pending interview request status.
  - Recruiter view integration in `JobPipelineView.tsx` and `CandidateProfileModal.tsx` showing pending interview request alerts.
- [x] Comprehensive test coverage:
  - 18 mock unit/security tests in `apps/api/tests/clientPortal.test.ts` (124 total repo tests passing).
  - 8 live Supabase integration tests passing in `test_phase6_e2e.mjs`.

---

### [COMPLETE] Phase 7 — Interview Scheduling, Calendar Events & SMTP Communications Outbox
- [x] Data Model & Schema:
  - Created `Interview`, `InterviewHistory`, and `OutboundCommunication` Prisma models with migrations.
  - Updated relations on `Organization`, `UserProfile`, `Client`, `Job`, `Candidate`, `Application`, and `InterviewRequest` (`interviewId` linkage).
  - Defined Zod validation schemas and shared DTOs in `@hiredesk/shared`.
- [x] Interview Scheduling Engine:
  - Server-side interval collision detection preventing double-booking (`startAt < existingEndAt && endAt > existingStartAt`) with `409 Conflict` (`INTERVIEWER_CONFLICT`).
  - Atomic conversion of client `InterviewRequest` records into scheduled interviews.
  - Support for video, phone, in-person, assessment modes with meeting links.
  - Rescheduling with sequence increments, cancellations with reason tracking, and completion with results.
- [x] RFC 5545 iCalendar Standards (.ics):
  - Pure RFC 5545 calendar event generator (`generateIcsCalendar`) with stable UIDs and UTC timestamps.
  - Sequence tracking (`SEQUENCE: 0` initial, incremented on reschedule).
  - Method declarations: `REQUEST` for invitations, `CANCEL` for cancellations.
  - Downloadable `.ics` attachments via authenticated endpoints for recruiters and clients.
- [x] Durable Communications Outbox & SMTP Transport:
  - Transactional outbox pattern ensuring emails are recorded atomically with interview operations.
  - Nodemailer SMTP delivery with TLS/STARTTLS support and transient error backoff retry.
  - Honest fallback when SMTP variables are omitted (`status: 'failed'`, code `SMTP_NOT_CONFIGURED`).
  - Manual retry capability for failed outbox entries.
  - HTML entity escaping preventing script injection in email bodies.
- [x] Client Portal Scheduled Interviews Tab:
  - Dedicated `Scheduled Interviews` tab in client portal (`GET /api/client-portal/interviews`).
  - Read-only view with join meeting links and `.ics` calendar downloads.
  - Complete confidentiality: internal recruiter notes redacted (`undefined`).
- [x] Recruiter Interviews View:
  - Full-featured recruiter UI (`/interviews`) with stats, filters, pending client requests banner, scheduling, rescheduling, completion, and communication history audit drawer.
- [x] Test Coverage & Build Verification:
  - 26 new automated unit/integration tests in `tests/interviews.test.ts` and `tests/email.test.ts` (150/150 monorepo tests passing).
  - 100% clean typecheck (`npm run typecheck`) and production build (`npm run build`).

---

### [POST-MVP] Phase 8 — Talent Pool, Analytics & Decision Support
- [ ] Organization-wide candidate talent pool search.
- [ ] SQL-derived analytics and time-to-hire reports.
- [ ] Explainable AI resume-to-job matching with documented scoring criteria.
