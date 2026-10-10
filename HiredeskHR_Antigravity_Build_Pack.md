# HiredeskHR — Antigravity Build Pack

This file is the source of truth for building HiredeskHR from scratch in Google Antigravity. Use the Master Prompt first, then run the phase prompts in order. Do not ask the agent to build the entire platform in one giant pass.

## How to use this pack

1. Create a new empty folder named `hiredeskhr` and open it as a project/workspace in Antigravity.
2. Start in Plan mode if available. Paste the **Master Prompt** below.
3. Have the agent create `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, and `docs/DECISIONS.md` before writing much code.
4. Review the plan. Then paste one phase prompt at a time, in order. Do not proceed to the next phase while the current phase has failing tests or unresolved security problems.
5. Create your own Supabase project and add credentials locally. Never paste secrets into chat or commit `.env` files.

---

# MASTER PROMPT — HiredeskHR

You are the lead software architect and implementation agent for **HiredeskHR**, a real, production-minded, multi-tenant Applicant Tracking System (ATS) built from scratch. The user is a student/founder building the application in Google Antigravity. Work incrementally, explain important choices clearly, and verify every change by running appropriate checks. Do not create a collection of static mock screens: major workflows must be connected end-to-end to real persistence.

## 1. Product and mission

HiredeskHR helps recruitment agencies hire candidates on behalf of multiple client companies. Recruitment agencies manage jobs, candidates, resumes, hiring stages, interviews and client reviews in one place. Each agency is an organization/tenant. A client must only see jobs, applications, candidate information, feedback and resumes that belong to that client's own jobs.

The product is inspired by the broad recruitment workflow of PyjamaHR, but HiredeskHR must have its own code, implementation, information architecture and visual identity. Do not copy proprietary source code, assets, or exact screen designs. The differentiator is the agency-focused client portal, strict tenant isolation, and a stable Job Code bridge for application ingestion.

The first MVP must reliably complete this loop:

1. User signs in.
2. Recruiter creates a job and the system generates a permanent globally unique Job Code, e.g. `JOB-1005`.
3. Recruiter manually posts the job on PyjamaHR with the Job Code included in the title, e.g. `Backend Developer JOB-1005`.
4. PyjamaHR distributes the job to LinkedIn or other supported boards and sends an application email when someone applies.
5. HiredeskHR reads the shared application mailbox over IMAP.
6. The worker extracts and normalizes a Job Code from the email subject, falling back to the email body.
7. A valid code matches exactly one HiredeskHR job. Never guess by title when a valid code exists.
8. HiredeskHR saves the inbound-message record, creates/reuses the candidate profile, creates or safely associates an application, stores the resume privately, and logs the activity.
9. The candidate appears in the correct job pipeline and the correct client portal.
10. Recruiter/client actions update persisted application stage and history.
11. Restarting the API/worker must not lose data or create duplicates.
12. Any application email that cannot be matched is recorded in an unmatched queue with a reason. No application silently disappears.

No direct LinkedIn Jobs API is assumed or promised. Keep the PyjamaHR email bridge until an authorized, official integration is available.

## 2. Final selected stack

Use a TypeScript-first npm-workspaces monorepo unless you can show a concrete reason not to. Keep dependencies stable and compatible; inspect official current documentation for API changes before using a library.

- Frontend: React, Vite, TypeScript, React Router, a consistent component system, responsive CSS, accessible forms.
- Backend: Node.js LTS, Express, TypeScript.
- Authentication: Supabase Auth.
- Database: Supabase-hosted PostgreSQL.
- ORM/migrations: Prisma. Use Prisma migrations/schema as the data-model source of truth. Do not create a second competing schema definition.
- Resume storage: Supabase Storage, private bucket only.
- Email ingestion: IMAP with `imapflow`; parse email and attachments with `mailparser`.
- Validation: Zod.
- Logging: Pino or another structured logger; redact credentials, tokens, attachment contents, and sensitive personal data.
- Testing: Vitest for unit tests, Supertest for API tests, and Playwright for critical browser end-to-end tests.
- Security middleware: Helmet, configured CORS, rate limits on auth-sensitive/public endpoints, request validation, consistent error responses.
- Background processing: initially a separately runnable Node worker with durable processing records; add Redis/BullMQ only when needed and document the operational requirement.
- Deployment target: frontend and API can be hosted separately; the IMAP worker must run in a persistent environment that supports long-running processes. Do not assume serverless functions can keep an IMAP connection alive indefinitely.

Keep the API as the central business-logic boundary. The browser may use Supabase Auth for sign-in/session, but all recruitment data mutations and sensitive reads should go through authenticated Express APIs unless there is a documented, reviewed reason to call Supabase directly. Do not expose database credentials or Supabase secret/service-role keys in frontend code.

### Database access and RLS rule

Use Prisma from Express for business data. Centralize authorization-aware service/repository functions; every read and write must be scoped by authenticated user role, organization, and client as applicable. Never rely on a frontend filter for security.

Enable Row-Level Security on tables exposed through Supabase APIs and write appropriate policies. Do not falsely claim that RLS protects a direct Prisma connection unless the actual connection role and request context make that true. Document the chosen model. If implementing RLS for Prisma queries, use a restricted non-bypass database role and transaction-local tenant/user context for every query transaction; prove it with tests. Never make an unrestricted `postgres` or service-role connection look protected by RLS when it bypasses it.

## 3. User roles and multi-tenancy

Initial roles:

- `super_admin`: platform-level administration.
- `recruiter`: manage jobs, candidates, applications, pipelines and assigned clients within their organization.
- `manager`: recruiter capabilities plus agency team/approval capabilities as defined in the permission matrix.
- `client`: access only its own client record and applications for jobs belonging to that client; can review, shortlist, reject or request an interview if permitted.

For MVP, a client login belongs to one organization and one client. A user profile maps the Supabase Auth user UUID to the HiredeskHR role, organizationId and optional clientId. Never use email alone as the authorization identity. Do not store passwords in application tables.

Tenant security rules:

- Organization is the top-level tenant boundary.
- Every job belongs to exactly one organization and one client in that organization.
- Every candidate belongs to an organization.
- Every application belongs to one candidate and one job; its client is derived from the job, or a denormalized clientId must be kept consistent by server/database rules.
- Every resume must be reachable only through an authorized candidate/application and a private storage path.
- Client data access is scoped to both organizationId and clientId, and the job/application relationships must be checked server-side.
- A client must never see another client's candidates or internal recruiter/admin notes.
- An organization must never see another organization's candidates, jobs, resumes, or activity.
- Authorization applies to every route, including downloads, previews, exports, manual assignment, and activity details.
- Super-admin actions should be explicit and audited.

## 4. Core data model

Design, document and implement these entities with proper UUID primary keys, foreign keys, indexes, timestamps, and database constraints. Exact field details can be refined during planning but do not remove the relationships below.

1. `Organization`: id, name, slug, status, createdAt, updatedAt.
2. `UserProfile`: Supabase Auth user id, organizationId nullable only for platform super-admin if necessary, role, clientId nullable, name fields, active state, timestamps. Ensure a single unambiguous mapping to the auth user.
3. `Client`: id, organizationId, name, contact details, status, timestamps.
4. `Job`: id, organizationId, clientId, jobCode, title, department, employmentType, workplaceModel, country, currency, salary range, experience, openings, deadline, education, skills, description, key requirements, status (`draft`, `published`, `closed`), application form configuration, createdBy, timestamps.
5. `Candidate`: id, organizationId, candidateCode, normalizedEmail, name, phone, location, country, skills, education, experience, source metadata, notes where safe, timestamps. Reuse a candidate record for the same normalized email within an organization when appropriate; do not merge candidates across organizations.
6. `Application`: id, candidateId, jobId, stage, source, appliedAt, status, application answers, recruiter-only notes kept separate from client-visible feedback, timestamps. A candidate can have multiple applications for different jobs; each application has its own stage and history. Define and test the behavior for repeat submissions to the same job so a retried email cannot create duplicates.
7. `Resume`: id, candidateId, optional applicationId, storage bucket/path, original filename, safe stored filename, content type, file size, checksum if practical, extracted text, parsing status/error, uploadedAt. Keep the real file in private storage; never store a public resume URL.
8. `InboundApplication`: id, mailbox identifier, IMAP UID validity and UID, Message-ID when available, subject, sender and recipient metadata, receivedAt, extracted Job Code, matched organization/job if identified, status (`received`, `processing`, `matched`, `unmatched`, `failed`, `retrying`, `manually_assigned`, or a clearly documented equivalent), failure reason, attempt count, processedAt, linked candidate/application and timestamps. It must support unmatched emails where organizationId is initially unknown.
9. `ActivityLog`: timestamp, actor user if applicable, organizationId, entity type/id, action, safe details. Append-only for important changes.
10. `StageHistory`: applicationId, previous stage, next stage, actor, timestamp, optional reason.
11. `Interview` as a later MVP/P1 module: applicationId, interviewer, scheduled date/time/time zone, type, meeting URL, status, feedback/result and timestamps.

### Candidate versus application

Keep the person (`Candidate`) distinct from each job-specific hiring process (`Application`). Do not make `Candidate.jobId` the only relationship if a candidate can apply to multiple jobs. Use `Application.jobId` as the authoritative job relationship. If a convenience `candidate.jobId` field is introduced for a legacy reason, clearly mark it non-authoritative and do not use it for counts or authorization.

### Global Job Codes

For this build, Job Codes are globally unique across HiredeskHR, stable and immutable. Generate them server-side in a concurrency-safe way using a PostgreSQL sequence or equivalent atomic mechanism. Format: `JOB-1001`, `JOB-1002`, etc. Never calculate the next code by counting rows. Add a unique constraint and, where practical, a database trigger or guarded update path preventing changes after creation. The actual application relationship uses `Job.id`; `jobCode` is an external matching identifier only.

### Email idempotency

A shared mailbox is used for MVP, and some emails will not contain a Job Code. Track messages independently from the job match. Use a durable mailbox identity plus IMAP `UIDVALIDITY` and UID as a processing key, and store the Message-ID when available. Make retries and restarts safe. Because an email with no code cannot yet be tied to an organization, do not require organizationId to exist before recording the inbound email. A repeated message must not create duplicate candidates, applications, resumes, or activity side effects. Document how UID reset/mailbox changes are handled.

## 5. Job Code and inbound email behavior

- Connect to the shared IMAP mailbox using environment variables; never hardcode credentials.
- Use secure IMAP configuration and timeouts.
- Read message subject, sender, recipient, text/HTML body, date, Message-ID, UID/UIDVALIDITY and attachments.
- Determine whether a message is an application email using explicit, testable rules. Do not drop a potential application just because the Job Code is absent.
- Extract Job Code from the subject first; then fall back to the body.
- Normalize case, whitespace and common dash variants; validate the full token against a strict pattern such as `JOB-\d+`. Add unit tests for whitespace, case and dash variants, malformed tokens, multiple codes, and no code.
- If a valid code is found, match only by exact `jobCode` in the global jobs table. Check job/organization/client relationships and job status policy. Do not fall back to title matching.
- If no valid code exists or no job is found, persist an `unmatched` record with the reason and any safe attachment metadata so an authorized reviewer can manually assign it later.
- If an email is not an application email, it may be marked `ignored` only with explicit detection rules and a recorded reason. Do not use `ignored` as the default for missing Job Codes.
- If an email/attachment/database operation fails, persist a failure record and a retry path. Do not report success just because the mailbox message was detected.
- Validate allowed resume types (PDF, DOC, DOCX), MIME, file size limits and filenames. Store files under random/generated object paths in a private bucket. Treat the original filename as display metadata only.
- Never log full email bodies, resume text, access tokens, credentials, or other unnecessary personal data.
- Implement exponential backoff/reconnect for transient IMAP errors and a controlled shutdown so a restart can safely resume.
- Manual assignment of an unmatched application must re-check permissions, validate the chosen job, preserve the inbound record, attach it to the selected job and process it idempotently.

## 6. MVP functional requirements

### Foundation and authentication
- Sign in, sign out, session restoration, password recovery.
- Create or invite user profiles with the correct organization, role and client association.
- Protected routes and server-side authorization.
- Onboarding/setup for the initial platform admin and organization. Never ship a publicly usable default admin password.

### Jobs
- Create, edit, save draft, publish, close, reopen, view, search and filter jobs.
- Generate permanent global Job Code on creation and provide a copy action.
- Store client, org, job details, skill requirements, opening count, deadlines and application-form configuration.
- Public career page can list published jobs and show job details.
- Applicant counts and dashboards must be computed from the database/server, not hardcoded values.

### Applications and candidates
- Candidate list and candidate detail page.
- Job-specific application pipeline with stages: `Applied`, `Screening`, `Shortlisted`, `Interview`, `AI Interview`, `Client Review`, `Selected`, `Hired`, `Rejected`, `Withdrawn`.
- Stage changes persist, produce stage-history and activity records, and are authorized by role.
- Resume preview/download uses authorized server endpoint or short-lived signed URLs after permission checks.
- Candidate profile displays resume metadata, application data, source, dates, allowed feedback, and activity.
- Do not expose recruiter-only notes to client users.

### Client portal
- Show only the logged-in client's active jobs and relevant applications.
- List candidates and open an allowed candidate profile/resume.
- Client actions: shortlist, reject, request interview, and leave feedback as authorized.
- API routes must verify organizationId, clientId, jobId and applicationId relationships server-side, not just trust URL values.

### Unmatched applications
- A queue showing date, sender metadata, subject, extracted code if any, attachment status, state and failure reason.
- Authorized manual job assignment and retry.
- No message silently disappears.

### Dashboard
- All counts are server/database-derived: total/active/draft/closed jobs, candidates/applications, new applications, shortlisted, interviews, selected, hired, jobs near deadline, recent activities.
- Empty states should be honest; demo/test data must not appear in production.

## 7. Post-MVP modules; don't implement before the core acceptance test passes

- Interview scheduling, statuses, feedback, email notifications and calendar integration.
- Mailbox/communication history and email templates.
- Talent pool and reusable candidate searches/folders.
- AI resume/job matching, summaries and natural-language search; scores must be computed from actual candidates with documented logic, never fake.
- Reports and notifications.
- Employee referrals, Chrome extension and more job boards.
- Billing/subscriptions.
- Direct LinkedIn integration only if a supported, authorized integration becomes available.

## 8. UX and quality bar

Build a clean professional SaaS interface for non-technical recruiters. Prioritize clarity and low-click workflows over flashy effects. Use responsive layouts, consistent spacing/type/color tokens, accessible labels, keyboard navigation, visible validation, loading states, success/error feedback, helpful empty states, table filtering/search and confirmation for destructive actions. Do not copy PyjamaHR pixel-for-pixel. Use the HiredeskHR brand name consistently.

The app must not use fake dashboard numbers, dummy candidates, simulated success, fake AI scores, or buttons that do nothing. If a module is not implemented, label it clearly as unavailable or keep it out of the active navigation.

## 9. Security and production requirements

- Never put secret keys, database passwords or SMTP/IMAP credentials in source control or frontend environment variables.
- Provide `.env.example` files only; ensure `.env*` secrets are gitignored.
- Verify Supabase JWT/session on the backend for protected APIs.
- Enforce role, tenant and client scope in every service/repository method.
- Use least-privilege database and storage access.
- Enable RLS on tables exposed through Supabase APIs and storage policies for private files. Explain how this interacts with Prisma's database connection; test the actual enforcement path.
- Use input validation, Helmet, restrictive CORS, rate limiting, size limits, safe error messages and structured redacted logs.
- Do not return stack traces or secrets to clients.
- Validate and sanitize uploaded files; use generated object keys; do not trust a supplied storage path.
- Use short-lived authorized download links or a protected streaming endpoint for resumes.
- Add audit trail for sensitive actions and manual assignment.
- Add backups/recovery notes for database and file storage separately.

## 10. Required repository layout

Use a clear monorepo. Adjust if genuinely necessary, but document the decision:

```text
hiredeskhr/
  apps/
    web/                  # React + Vite + TypeScript
    api/                  # Express + TypeScript
    worker/               # IMAP/email ingestion worker
  packages/
    database/             # Prisma schema, migrations, Prisma client
    shared/               # shared enums and Zod schemas where appropriate
  supabase/
    migrations/           # SQL for RLS/storage/sequence/trigger if needed
  docs/
    PRODUCT_SPEC.md
    ARCHITECTURE.md
    DATA_MODEL.md
    SECURITY_MODEL.md
    IMPLEMENTATION_PLAN.md
    ACCEPTANCE_TESTS.md
    DECISIONS.md
  .env.example
  .gitignore
  package.json
  README.md
```

Keep dependency versions compatible and scripts deterministic. Don't run destructive migrations against a real project without telling the user and getting approval. Do not use actual production mailbox credentials or upload real candidate resumes while testing.

## 11. Tests and definition of done

A feature is complete only if its UI/API/service/database/validation/authorization/error handling/persistence/test paths work. For each phase:

1. Write unit tests for business rules.
2. Write API tests for success, bad input, unauthorized access and tenant isolation.
3. Test database constraints/migrations where applicable.
4. Run type-check/lint/tests/build and fix issues before declaring success.
5. State exactly which commands ran and their real results. Never claim a test passed if it was not run.
6. Document remaining gaps and how to reproduce any failure.

Critical acceptance test (must pass repeatedly):

1. Sign in as a recruiter in Organization A.
2. Create a test client and a published Backend Developer job.
3. Confirm a permanent global Job Code is generated; copy it.
4. Simulate a parsed application email fixture whose subject/body contains that Job Code and whose attachment is a valid test resume.
5. Confirm the worker creates exactly one inbound record, resolves the exact job, creates/reuses the candidate, creates/associates the correct application, stores a resume privately, and writes activity/stage history as appropriate.
6. Confirm application appears as `Applied` in the recruiter's job pipeline and correct counts update from database queries.
7. Sign in as that job's client; confirm that client can see only permitted job/application/resume data.
8. Sign in as a different client and a different organization; confirm neither can access the candidate, application, activity or resume, even by guessing API IDs/URLs.
9. Re-run the same message and restart the worker; confirm no duplicate candidate, application, resume or repeated business side effect is created.
10. Test no-code, unknown-code, malformed-code, unreadable/missing-resume, transient IMAP/database failure and manual-assignment cases. Each potential application must remain visible as matched, unmatched or failed/retryable with a reason.
11. Change application stage from Applied to Shortlisted; restart API/worker; confirm stage and history remain correct.

Success targets: no silently dropped application emails; zero duplicate processing after retry/restart; every matched application has valid organization/job/client links; zero cross-client or cross-organization access; dashboard figures are database-derived.

## 12. How you must work in Antigravity

- Begin by reading this prompt and producing a plan before substantial implementation.
- First create the documentation artifacts and architecture decisions. Ask only essential clarification questions; otherwise make conservative choices and record them in `docs/DECISIONS.md`.
- Implement one phase at a time. Do not try to finish every module in one response.
- At the end of each phase, summarize files changed, design decisions, commands run, test results and the next phase.
- If a command fails, diagnose and fix it; don't proceed as though it succeeded.
- Never overwrite or remove user data or secrets. Do not automatically deploy or change DNS.
- Do not introduce dependencies or services without explaining why.
- If an external API/credential is unavailable, create a testable adapter/interface and fixture-based tests; don't pretend the integration is live.
- Keep a `docs/IMPLEMENTATION_PLAN.md` checklist up to date.

**First task now:** inspect the workspace. If empty, create the docs listed above and a detailed phased implementation plan, then implement only Phase 0 (monorepo scaffold, formatting/lint/typecheck/test scripts, `.env.example`, health-check API, basic web shell, README) if the plan is coherent. Do not build the entire ATS in the first pass. Run available checks and report the exact results.

---

# PHASE PROMPTS — Use one at a time

## Phase 0 — Scaffold and standards

Using the Master Prompt and existing `docs/` as the source of truth, create the monorepo scaffold only. Set up npm workspaces, `apps/web`, `apps/api`, `apps/worker`, `packages/database`, `packages/shared`, lint/format/type-check/test/build scripts, `.env.example`, `.gitignore`, and README. Add a very small accessible web shell with routes/placeholders only for implemented navigation, an Express `/health` endpoint, safe structured logging, request IDs, and a consistent error response. Do not add fake data or pretend modules work. Add CI workflow if easy. Install dependencies if network is available, run the checks, fix errors, and report any check that could not run.

## Phase 1 — Supabase, authentication, profiles and tenant authorization

Implement Supabase Auth sign-in/sign-out/session restoration/password recovery in the frontend. Configure Express to validate incoming Supabase access tokens using the supported server-side method. Create database schema and migrations for Organization, UserProfile, Client and ActivityLog as needed. Add an explicit initial-admin/organization setup path that cannot be claimed by an unauthenticated stranger and does not use a hardcoded default password. Add role-aware middleware and a single, tested authorization layer. Add an API test matrix proving that unauthenticated users are denied, recruiters cannot access another organization, client users are restricted to their one client, and unknown/inactive users are denied. Document RLS and database-role behavior honestly. Do not start Jobs/email until this phase's tests pass.

## Phase 2 — Jobs and global Job Codes

Implement Job CRUD APIs and a usable Jobs UI. Add server-side validation with Zod, organization/client authorization, draft/published/closed status, search/filter, job detail, and database-derived applicant counts. Generate global Job Codes atomically from PostgreSQL using a sequence or equivalent; format `JOB-1001`; protect uniqueness and immutability. Don't compute the next code by counting records. Enforce that a selected client belongs to the recruiter’s organization. Add database migrations, API tests, UI validation/empty/loading/error states, and tests for concurrent job creation proving no duplicate codes. Implement a copy-code action. Add a public read-only job detail for published jobs, but do not implement external LinkedIn APIs.

## Phase 3 — Application and candidate schema + public career application

Implement Candidate, Application, Resume metadata, StageHistory and the relationships/constraints. Candidate is person-level; Application is job-specific and owns stage. Build the organization's public career page for published jobs and a real apply flow. Validate form input, rate-limit public applications, validate upload size/type, save files privately and make resume access authorized. Application submission must be atomic or safely recoverable so a partial failure is not reported as success. Add tests for same candidate applying to multiple jobs, repeat submissions, invalid jobs, closed jobs, invalid files and cross-tenant isolation. Dashboard numbers must be database-derived.

## Phase 4 — Email ingestion and unmatched queue

Implement the separate Node worker with configurable IMAP connection using environment variables. Use `imapflow` and `mailparser`. Build and test Job Code extraction/normalization (subject then body; strict `JOB-\d+`; never job-title guessing). Persist inbound records before or as processing starts, using mailbox identity + UIDVALIDITY + UID and Message-ID when available. Implement statuses, retry/backoff, reconnection, safe shutdown, idempotent processing and a failed/unmatched queue. Match only globally unique jobCode, then derive organizationId/clientId from the matched Job. Use fixtures for valid-code, unknown-code, no-code, malformed code, multiple code, missing attachment, invalid attachment, duplicate message and parser/database failures. Persist resume object path privately and metadata. Implement an authorized recruiter/admin UI to view unmatched messages, see reasons, assign a job and safely retry. Don't silently discard potentially relevant application emails. Add logs with message IDs/code/status, but never log full email bodies or resume text. Document mailbox test setup without real credentials. Prove a worker restart does not duplicate side effects.

## Phase 5 — Recruiter dashboard, candidate profile and pipeline

Build real recruiter dashboard metrics from API/database queries. Implement job pipeline with counts by stage; application list; candidate profile showing safe candidate fields, application answers, resume access, source, application date and timeline. Implement stage change endpoint with role checks, valid transition validation, StageHistory and ActivityLog. Keep recruiter-private notes separate from client-visible feedback. Add filters, search, pagination where practical, empty/loading/error states. No hardcoded applicant counts or demo activity. Test stage persistence across server/worker restarts.

## Phase 6 — Client portal and isolation hardening

Implement the client dashboard, active jobs, application list, allowed candidate profile and protected resume access. Add client review actions (shortlist, reject, request interview) with proper authorization and activity records. A client can only see data related to its own clientId and organizationId; use relationship checks rather than trusting route IDs. Add negative security tests that attempt to access other clients’ and organizations’ resources by guessing IDs, changing route parameters, downloading resumes and accessing activity APIs. Ensure internal recruiter notes and admin information are not returned to clients. Repeat the complete critical acceptance test end-to-end.

## Phase 7 — Interviews and communications (only after P0 loop passes)

Implement interview scheduling linked to application/job/candidate/interviewer, time zone, type, meeting link, status (`Scheduled`, `Completed`, `Cancelled`, `No Show`, `Rescheduled`), feedback and result. Email notifications should actually send through configured SMTP/provider and be logged; if credentials are absent, show an explicit configuration error, never fake a send. Add reusable email templates and candidate/client communication history where linked to a real application. Calendar integration should be real or clearly marked not configured. Test authorized visibility for recruiter and client.

## Phase 8 — Talent pool, analytics, AI and later modules

Only after all earlier acceptance tests pass. Add a searchable talent pool with organization-scoped candidate reuse; accurate reporting computed by SQL/API; notifications; employee referrals as a later feature; and AI candidate-job matching only when a real model/provider is configured. Any AI score must have transparent inputs and be recorded with model/version/createdAt; do not fabricate scores or use an LLM alone to make a consequential hiring decision. Treat AI as decision support for human reviewers. Billing and additional job-board integrations are later. Every module needs a real backend, validation, authorization, persistence and end-to-end tests before appearing as “complete.”

---

# Final instruction to the agent

Do not skip phases because the UI looks complete. The critical acceptance test is the release gate. At every phase, if you discover a conflict between this brief and an implementation convenience, preserve the product/security requirements and explain the trade-off in `docs/DECISIONS.md`. Never claim features or tests are complete unless they actually are.
