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

### [PENDING] Phase 5 — Recruiter Dashboard, Candidate Profile & Pipeline
- [ ] Live database-derived metrics API (active jobs, candidate counts by stage).
- [ ] Visual candidate pipeline board (Kanban / stage-grouped list) in `apps/web`.
- [ ] Candidate detail page with resume preview and application history.
- [ ] Stage transition API with role checks, `StageHistory`, and `ActivityLog`.
- [ ] Separation of recruiter-internal notes from client-visible notes.
- [ ] Tests verifying stage persistence across server restarts.

---

### [PENDING] Phase 6 — Client Portal & Isolation Hardening
- [ ] Client user dashboard restricted to assigned `clientId`.
- [ ] Client review actions: Shortlist, Reject, Request Interview, Leave Feedback.
- [ ] Authorization enforcement preventing access to recruiter-only notes.
- [ ] Negative security tests: attempt cross-client and cross-org access via ID manipulation.
- [ ] End-to-end critical acceptance test run.

---

### [POST-MVP] Phase 7 — Interviews & Communications
- [ ] Interview scheduling module with time zones and meeting links.
- [ ] Email notifications with real SMTP provider integration.
- [ ] Communication history log.

---

### [POST-MVP] Phase 8 — Talent Pool, Analytics & Decision Support
- [ ] Organization-wide candidate talent pool search.
- [ ] SQL-derived analytics and time-to-hire reports.
- [ ] Explainable AI resume-to-job matching with documented scoring criteria.
