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

### [PENDING] Phase 2 — Jobs & Atomic Global Job Codes
- [ ] PostgreSQL atomic sequence (`job_code_seq`) and function for `JOB-1001` format.
- [ ] Prisma Job schema migration with uniqueness and immutability rules.
- [ ] Job CRUD endpoints in `apps/api` with Zod validation.
- [ ] Job management UI in `apps/web` (create, edit, draft, publish, close, filter).
- [ ] Copy Job Code action.
- [ ] Public read-only job detail page.
- [ ] Concurrency tests proving zero duplicate job codes under load.

---

### [PENDING] Phase 3 — Candidate, Application & Public Career Portal
- [ ] Prisma schema migrations for `Candidate`, `Application`, `Resume`, and `StageHistory`.
- [ ] Candidate deduplication by `(organizationId, normalizedEmail)`.
- [ ] Public application submission API with file upload validation (PDF/DOCX, 10MB).
- [ ] Private Supabase Storage upload integration.
- [ ] Public career page apply form with responsive UX and honest loading/success states.
- [ ] Tests for candidate reuse, repeat applications to the same job, and file validation.

---

### [PENDING] Phase 4 — Email Ingestion Worker & Unmatched Queue
- [ ] IMAP client in `apps/worker` using `imapflow`.
- [ ] MIME parsing and attachment streaming using `mailparser`.
- [ ] Job Code extractor (subject line first, body fallback, strict `JOB-\d+`).
- [ ] Idempotency tracking table `InboundApplication` (mailboxId + UIDVALIDITY + UID).
- [ ] Unmatched queue management API and UI in `apps/web`.
- [ ] Manual assignment flow for recruiters to match unparsed emails to jobs.
- [ ] Offline fixture tests for valid-code, no-code, malformed-code, and duplicate emails.

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
