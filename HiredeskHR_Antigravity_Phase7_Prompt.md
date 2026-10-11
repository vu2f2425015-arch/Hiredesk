# HiredeskHR — Phase 7 Antigravity Build Prompt
## Interview Scheduling, Calendar Events, SMTP Email Delivery & Communication History

Paste this prompt into Antigravity while your existing HiredeskHR repository is open. Implement this phase incrementally in the current codebase; do not regenerate or rewrite the monorepo.

---

# MASTER PROMPT

You are continuing development of **HiredeskHR**, a multi-tenant applicant tracking system (ATS) built with React/Vite/TypeScript, Node.js/Express/TypeScript, Prisma, Supabase PostgreSQL, Supabase Auth, and private Supabase Storage.

Phase 6 is reported complete. The current product includes jobs and permanent Job Codes, public job applications, candidate profiles, private resumes, inbound email ingestion and an unmatched-application queue, recruiter dashboard/pipeline, and a client portal. The Client Portal supports shortlist/reject/feedback and persists interview requests with `status: pending`.

This phase is **Phase 7: Interview Scheduling, Calendar Events, SMTP Email Delivery & Communication History**.

## A. Non-negotiable working rules

1. Before changing code, read the current `README.md` and these documents if present: `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCEPTANCE_TESTS.md`, and `docs/DECISIONS.md`.
2. Inspect the current Prisma schema and migration history, existing `InterviewRequest`, `Application`, `StageHistory`, `ActivityLog`, current client portal, API services/routes, auth middleware, worker design, environment variables, and existing tests.
3. Run the baseline `npm run typecheck`, `npm test`, and `npm run build` before modifications. Record exact results and fix only regressions introduced by this phase.
4. Preserve the existing architecture, conventions, API response shape, request IDs, structured logging, role rules and working tests. Do not recreate completed modules.
5. Work in checkpoints: schema/migrations → backend services → integration tests → frontend → full verification. Do not proceed past a failed checkpoint without fixing or documenting the blocker.
6. Never fabricate credentials, calendar links, email delivery results, interview statuses, feedback, or provider integration success. Mocked tests must be clearly distinguished from live integration tests.
7. Never print or commit passwords, SMTP credentials, Supabase secrets, access tokens, calendar OAuth tokens, resume contents, or unnecessary candidate PII. Use server-side environment variables only.
8. Update documentation based on behavior actually implemented. Do not mark a feature complete merely because a screen exists.
9. Do not start AI interviews, AI Recruiter, billing, or unrelated future features in this phase.

## B. Goals

Implement a real interview workflow that:

- Converts a pending client interview request into a scheduled interview only after an authorized recruiter takes the scheduling action.
- Supports an interview linked to the correct organization, client, job, application, candidate, and interviewer.
- Stores start/end timestamps and timezone consistently; handles daylight-saving changes correctly.
- Supports scheduling, rescheduling, cancellation, completion, no-show, and feedback/result recording with an audit trail.
- Can send actual interview-invitation, reschedule, cancellation, and appropriate candidate/client notification emails through configured SMTP.
- Records email send attempts and results, associates communication with the relevant candidate/application/job, and avoids duplicate sends caused by retries.
- Shows scheduled interviews in a useful calendar/list UI for authorized recruiters and the appropriate limited view for clients.
- Clearly reports when SMTP/calendar integrations are not configured. Never claim an email was sent or a calendar event was created if that action did not succeed.

## C. Data model and migration

Inspect the current Prisma schema first. Reuse and extend existing models where possible; do not create duplicate parallel models.

### Interview

Ensure a persisted `Interview` model (or equivalent current model) supports at least:

- `id`
- `organizationId`
- `clientId`
- `jobId`
- `applicationId`
- `candidateId` if useful for querying, with consistency verified against the application
- `interviewerUserProfileId` (or the current valid user relation)
- `scheduledByUserProfileId`
- `type` (for example `video`, `phone`, `onsite`, `technical`, `other`; use the project's existing enum conventions)
- `status`: `scheduled`, `completed`, `cancelled`, `no_show`, `rescheduled`
- `startAt` and `endAt` stored as timezone-aware instants (PostgreSQL `timestamptz` / Prisma `DateTime` mapping appropriate for PostgreSQL)
- `timeZone` as an IANA timezone identifier (for example `Asia/Kolkata`)
- `meetingProvider` (nullable, e.g. Google Meet, Zoom, Microsoft Teams, phone, onsite)
- `meetingUrl` (nullable; only a real supplied/generated URL, never an invented one)
- `location` (nullable)
- `interviewerNotes` or internal notes with restricted access
- `feedback` and `result` with clearly defined access controls
- `createdAt`, `updatedAt`, and relevant status timestamps if consistent with the codebase

Use foreign keys and indexes for tenant-scoped queries. Add constraints or service validation to reject `endAt <= startAt`, cross-organization relations, or a client/job/application combination that does not match.

Use the existing `InterviewRequest` model. When a recruiter schedules from a pending request, link the resulting interview and update the request status consistently (for example `scheduled` plus `interviewId`). Do not delete the request history. Define the allowed request statuses and transition rules explicitly. Repeated scheduling actions must not create multiple interviews from the same pending request unless an explicit reschedule flow is used.

### Interview status history

Use the existing `ActivityLog` and/or `StageHistory` patterns, or add a dedicated history entity if necessary. Each transition should record actor, timestamp, previous status, new status and entity references. Use a database transaction for related changes.

### Email/communication model

Inspect existing models before adding a new one. Persist an outbound communication record with at least:

- organization, candidate/application/job and optional interview references
- recipient(s) and template/type
- subject and template identifier (do not store credentials)
- status: `queued`, `sending`, `sent`, `failed` (or the existing consistent set)
- provider/message ID when returned
- attempt count, last attempted time, sent time, and a safe error code/message
- idempotency key
- timestamps

Do not save SMTP passwords or full authentication headers. Carefully limit retention of email bodies and candidate PII; document what is stored. If content is stored, use a clear retention/security approach.

Create a versioned Prisma migration under the established `packages/database/prisma/migrations/` structure. Do not rely on `prisma db push` as a substitute for committing the migration. If live Supabase migrations cannot run, leave an explicit, safe instruction; do not claim the live DB was migrated.

## D. Scheduling rules and API

Inspect existing routes and naming conventions, then add a consistent interview API. Adapt route names if a current endpoint already exists.

Required behaviors (exact paths may follow existing conventions):

- List interviews for the authenticated recruiter with filters for date range, status, job, interviewer and client, scoped by organization.
- Get one interview with safe DTOs and tenant checks.
- Schedule an interview from a valid application or pending `InterviewRequest`.
- Reschedule an interview, preserving prior values in history and generating the correct notifications.
- Cancel an interview with an optional/required reason as defined in product rules.
- Mark an interview completed or no-show, enforcing legal transitions.
- Record feedback/result with separate internal and client-visible fields if needed.
- Allow an authorized client to view the appropriate scheduled interview information for its own application, but not internal interviewer notes or other candidates' details.

Use `authenticate`, role/tenant helpers, Zod validation, consistent error envelopes, request IDs and structured logging.

### Access-control requirements

- `super_admin`: platform access, following existing design.
- `manager` and `recruiter`: schedule and manage interviews only within their organization, with client/job links validated server-side.
- `client`: may view permitted interviews and submit allowed review/request actions only for their assigned client; cannot create arbitrary interview records, change interviewer, read internal notes, or access another client's interview.
- External candidates do not get authenticated portal features in this phase unless that already exists and is specified.
- Never trust `organizationId`, `clientId`, `candidateId`, `jobId`, or actor IDs merely because the frontend submitted them. Resolve relationships from persisted, authorized records.
- Cross-tenant/cross-client attempts should return a non-disclosing 404 where consistent with existing security policy.

### Time validation

- Accept ISO-8601 timestamps with timezone context or a well-defined local date/time plus IANA timezone.
- Normalize persisted times to instants; return the timezone needed for display.
- Reject invalid dates, end time not after start, and unsupported/ambiguous input.
- Define a reasonable minimum duration and maximum advance booking only if the product specification supports it; otherwise document the chosen MVP validation.
- Avoid double-booking the same interviewer where overlapping scheduled interviews are detected. This check must be server-side and tested. If concurrency makes a simple check insufficient, use a transaction/advisory-lock or an explicit conflict constraint/strategy and document it.
- Do not claim calendar availability was checked unless a real calendar integration is configured and used.

## E. SMTP delivery and templates

Use the existing Hostinger SMTP setup/configuration if present. Implement with the repository's current email library or a well-maintained Node.js SMTP library such as Nodemailer if no suitable library exists.

Required server-side configuration should be validated at startup or on a health/status check without revealing values. Use variables such as:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_NAME`
- `SMTP_FROM_EMAIL`
- any required application public URL/base URL

Follow the current environment naming style if the project already uses equivalent settings. Never use `VITE_` prefixes for secrets.

Implement safe, escaped templates for at least:

1. Interview invitation to candidate.
2. Interview scheduled/rescheduled notice to client where policy requires.
3. Interview rescheduled notice to candidate.
4. Interview cancellation notice to candidate and/or client as appropriate.
5. Interview completion/follow-up message only if the workflow requires it.

Every message should use verified database details, a clear timezone, date/time, interview mode and meeting link/location only if available. Do not expose internal notes. Do not email a recipient taken from an untrusted frontend field without checking it against the stored candidate/client records.

### Reliable sending

- Store an outbound communication record before or as part of scheduling-related work so failed sends remain visible.
- Sending email and committing relational data cannot generally be one atomic transaction. Use a durable queued/outbox pattern or a recoverable state machine so a crash between database commit and SMTP send does not silently lose the email.
- Prevent duplicate send attempts with a stable idempotency key per interview event/recipient/template/version.
- Use bounded retry with backoff for transient errors; distinguish retryable and permanent errors.
- Record `sent` only after the SMTP provider accepts the message and returns success. Clearly explain that SMTP acceptance does not guarantee inbox delivery.
- On permanent failure, show a truthful error state and allow authorized manual retry.
- Do not retry indefinitely. Avoid sending duplicate emails when a timed-out SMTP response leaves delivery status uncertain; record the uncertainty and require a safe policy.
- If a background worker/queue exists, extend it. Otherwise create a small, documented outbox worker or scheduled processor that can run independently, prevents overlapping sends, handles shutdown, and survives restarts. Do not add Redis/BullMQ solely for appearance; use the simplest robust option consistent with the current architecture and explain the tradeoff.

## F. Calendar integration: implement honestly in layers

First deliver a reliable internal interview calendar/list based on database records.

For calendar invitations, implement a standards-based `.ics` iCalendar attachment where feasible. Ensure the generated event contains correct UTC times, timezone details, stable UID, start/end, summary, description that excludes sensitive notes, organizer/attendee information where supported, and cancellation/reschedule semantics. Validate with tests. Do not say this created an event in Google Calendar or Microsoft Outlook; the attachment merely lets recipients add it to a calendar.

If this project already has a configured Google Calendar or Microsoft Graph integration with valid credentials, inspect it and integrate properly with OAuth token storage, tenant scoping, refresh/error handling and idempotency. If it has no credentials, do not invent them or block the core MVP. Implement provider interfaces and document the exact manual setup needed for a real API integration in a later checkpoint.

Meeting URLs:
- Accept an already configured/reliably generated meeting URL.
- Do not fabricate Google Meet/Zoom/Teams URLs.
- If no meeting provider integration exists, allow a valid meeting URL to be added by an authorized recruiter and label the feature accurately.

## G. Frontend

Build upon the current HiredeskHR visual design; do not redesign unrelated pages.

Add or improve:

1. Recruiter Interviews page with list/calendar-style view, date navigation, status filters, job/client/interviewer filters, and empty/loading/error states.
2. Schedule Interview flow launched from an application/candidate and from the Interviews page.
3. Fields for job/application/candidate, interviewer, date, start/end time, timezone, interview type, location/meeting URL, and optional safe notes.
4. Detail view showing status, history, invite/email status, and permitted actions.
5. Reschedule and cancel confirmations.
6. Honest badges for email status: queued, sent, failed, or delivery status unknown.
7. Client portal view of appropriately shared scheduled interviews and status, not internal notes or system diagnostics.
8. Pending client interview requests should be visible to the recruiter and can be converted into a real scheduled interview.
9. Loading states, disabled submit during in-flight requests, duplicate-click protection, field validation, and actionable errors.

Do not show fake calendar data or hardcoded counts.

## H. Tests

Add unit/API tests using the existing test stack. Mock SMTP and calendar integrations for deterministic automated tests, while clearly separating them from live integration tests.

At minimum test:

- Valid interview can be scheduled and is persisted.
- End time before/equal start time is rejected.
- Application/job/candidate/client/org relationships are checked from the database.
- Recruiter cannot schedule for another organization.
- Client cannot create or edit unauthorized interviews.
- Client cannot view another client's interviews.
- Client cannot read internal interviewer/recruiter notes.
- Invalid status transitions are rejected.
- Rescheduling records the previous values and preserves history.
- Cancelling an interview marks status and queues appropriate communication.
- Overlapping interviewer appointments are rejected or handled by the documented policy.
- Pending `InterviewRequest` is linked exactly once to a scheduled interview.
- SMTP success changes communication status to sent with provider response metadata.
- SMTP transient failure is retried according to policy.
- SMTP permanent failure is visible and can be retried by an authorized user.
- Repeated scheduling or notification attempts do not create duplicate interviews or duplicate outbox entries.
- Outbox/worker restarts recover queued work safely.
- `.ics` output contains stable event UID and correct times; reschedule/cancel behavior is tested.
- HTML templates escape candidate-provided fields to prevent email HTML injection.
- No secret values or raw sensitive content are emitted in logs.
- Existing Phase 0–6 test suites remain green.

Only report tests actually run. If a live SMTP server or calendar provider is not configured, mark those integration tests as not run and give exact manual verification steps.

## I. Documentation and environment setup

Update:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`
- `.env.example`
- `README.md`

Document required SMTP variables, how to test SMTP safely, how to create a test interview, the outbox retry policy, `.ics` behavior, and what calendar provider features are and are not configured.

No real secret values should be added to `.env.example`. Keep local `.env` ignored by Git.

## J. Verification and definition of done

Run the following from the repository root, matching existing package scripts:

1. Prisma schema validation/client generation.
2. Migration consistency checks.
3. `npm run typecheck`.
4. `npm test`.
5. `npm run build`.
6. The existing live-Supabase end-to-end suite, only if safe test data and credentials are configured. Clean up test records or clearly document retained fixtures.
7. SMTP integration test only if a configured test mailbox/provider is available. Use a controlled recipient and never email real candidates during verification.

Phase 7 is complete only when:

- Interview scheduling is real and persisted.
- Valid role and tenant boundaries are enforced by the API.
- Schedule/reschedule/cancel state changes are auditable and transactionally correct.
- Outbound emails are driven by real events and safely retried.
- Email attempts have durable, honest statuses.
- Calendar event files are valid if implemented; real Google/Outlook API integration is not claimed unless actually configured and verified.
- Client-visible data is properly redacted.
- All existing tests remain green and new tests cover the critical workflows.
- Build and type-check pass.
- Documentation matches verified behavior.

At completion, provide a precise report containing files changed, migration status, test counts, build/typecheck outcomes, which tests were mocked vs live, SMTP/calendar configuration still required, unresolved risks, Git commit hash, and recommended next phase.

**Do not start Phase 8 until Phase 7 has passed its acceptance criteria.**
