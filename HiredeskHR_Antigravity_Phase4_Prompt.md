# HiredeskHR — Phase 4 Antigravity Build Prompt
## Inbound Email Ingestion, Job Code Matching, Retry Safety, and Unmatched Applications

Use this prompt in the existing HiredeskHR Antigravity workspace. The project already has Phase 0–3 scaffolding, Supabase Auth, Express APIs, Prisma/PostgreSQL, job CRUD and globally unique Job Codes, candidate/application handling, private Supabase resume storage, and a public application form. Continue from the existing repository; do not recreate the project.

---

# MASTER PROMPT — PHASE 4 ONLY

You are implementing **Phase 4 of HiredeskHR**, a multi-tenant recruitment ATS. Read these files first and treat them as the source of truth:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/DECISIONS.md`
- `packages/database/prisma/schema.prisma`
- existing job, application, candidate, storage, and worker source files
- the Phase 3 application service and tests

Inspect the current implementation before editing it. Confirm actual types, database constraints, environment variables, routes, and test conventions. Do not assume prior completion reports prove a feature is correct; verify it from the code and tests.

## Scope boundary

Implement only inbound email ingestion and its supporting persistence/API behavior. Do not implement interviews, Talent Pool, AI Recruiter, billing, extra job boards, or unrelated UI redesign. Preserve all existing phases and tests. Do not rewrite the public application flow. Public form applications and email-ingested applications must use the same candidate/application domain model and security rules.

## Agreed product decisions

- Use the existing stack: React/Vite/TypeScript, Express/Node/TypeScript, Prisma with Supabase PostgreSQL, Supabase Auth, and private Supabase Storage.
- One shared inbound mailbox for the MVP.
- Job Codes are globally unique and permanent, e.g. `JOB-1001`.
- The Job Code is an external matching identifier. The canonical relationship is `Application.jobId -> Job.id`.
- Never guess a job by title when the code is absent, malformed, ambiguous, or unknown.
- An email must never disappear silently. Every relevant application email must end in a matched/processed record, a visible unmatched record, or a visible failed/retryable record.
- Store resumes only in the existing private storage bucket. Never create public resume URLs or expose service-role keys to the browser.
- If the organization cannot be identified from an exact Job Code, retain the email in a restricted platform-level unmatched queue. Do not attach it to an arbitrary organization.

## Phase 4 success criteria

An application email from PyjamaHR can be retrieved via IMAP, parsed, matched using a global Job Code, processed safely, and represented in the correct organization/job pipeline without duplicate candidate/application records. An email with no code or an unknown code remains available for authorized manual resolution. Reconnecting or restarting the worker does not lose or duplicate work.

---

## 1. Inspect current state before coding

1. Find the current worker entry point, configuration loading, logger, Job Code extractor, Prisma models, candidate/application service and storage service.
2. Read the current Prisma schema and migration history. Do not overwrite or squash existing migrations.
3. Identify how worker and API share Prisma, runtime configuration, and error response conventions.
4. Run baseline commands before changes:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
5. Record existing failures separately. Do not claim they are fixed if they predate this phase.
6. Report a short implementation plan before making broad changes.

## 2. IMAP mailbox client

Implement the actual inbound mail client in the existing `apps/worker` workspace (or the repository's established worker location). Prefer `imapflow` and `mailparser` if compatible with the current dependency versions.

Required behavior:

- Read IMAP hostname, port, secure/TLS flag, mailbox username/password, polling interval, and mailbox identity from validated server-only environment variables.
- Support the configured Hostinger IMAP endpoint, with sensible configurable defaults only where appropriate.
- Never hard-code secrets, credentials, email addresses, or live project references.
- Connect securely, select the intended mailbox, fetch new/unprocessed messages, and retrieve envelope, subject, sender, recipients, body, headers, attachments, UID, UIDVALIDITY, and Message-ID as available.
- Use an IDLE-capable or polling approach appropriate for the library; document which approach is implemented.
- Implement connection timeouts, reconnects, retry with exponential backoff and bounded jitter, clean shutdown, and non-overlapping polling cycles.
- Do not mark a message as successfully processed before all required database/storage changes have been persisted.
- Treat IMAP UIDs as mailbox-scoped and UIDVALIDITY-scoped. A mailbox reset can reuse UIDs. Include a stable mailbox identifier and UIDVALIDITY in the idempotency identity; Message-ID is an additional deduplication signal, not a substitute for UIDVALIDITY handling.
- If headers are absent or malformed, handle safely and record diagnostic metadata without leaking message contents into logs.
- Logs must include a request/correlation ID or ingestion event ID, mailbox identifier, UIDVALIDITY, UID, extracted Job Code where safe, status, and a concise failure reason. Never log passwords, tokens, full resume content, or unnecessary candidate PII.

Suggested server-side configuration (adapt to existing config conventions):

```dotenv
IMAP_HOST=
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USERNAME=
IMAP_PASSWORD=
IMAP_MAILBOX=INBOX
IMAP_POLL_INTERVAL_MS=30000
IMAP_MAX_RETRIES=8
INBOUND_MAILBOX_ID=primary-hostinger-inbox
```

Add these to `.env.example` with blank placeholders, and ensure real `.env` is ignored by Git. Validate configuration at startup and give actionable errors without echoing secret values.

## 3. Extract and normalize Job Codes safely

Reuse and extend `apps/worker/src/jobCodeExtractor.ts`; do not create a competing extractor without a reason.

Requirements:

- Parse subject first, then plain-text body, then a safely extracted text representation of HTML if needed.
- Support case and reasonable spacing/dash variants, normalizing a code to uppercase canonical form like `JOB-1005`.
- Match the complete token only. Do not match `JOB-1005` as part of `JOB-10050`.
- If multiple distinct Job Codes occur in a message, classify as `ambiguous_job_code` unless deterministic business rules can prove which single code represents the application. Do not silently pick the first code.
- An email with no Job Code gets an unmatched record with reason `no_job_code` (unless it is clearly not an application notification and is safely classified as ignorable by an explicit, tested rule).
- A syntactically valid but unknown Job Code gets `job_code_not_found`.
- Never match by title as a fallback.
- Keep normalizer/extractor functions pure and cover them with unit tests.

## 4. Persistence model and idempotency

Use the existing Prisma schema where possible. Add a versioned Prisma migration for missing fields, indexes, enums, or constraints. Do not rely on ad-hoc `db push` for production migrations.

Ensure there is a durable inbound-message/application-ingestion record, with fields equivalent to:

- `id`
- `mailboxId`
- `uidValidity`
- `uid`
- `messageId` (nullable if missing)
- `subject` (careful with PII; only keep if needed)
- `jobCode` (normalized, nullable)
- `matchedJobId` (nullable until matched)
- `organizationId` (nullable while unmatched if the tenant is unknown)
- `clientId` (nullable until a matched job establishes it)
- `status`: pending / processing / matched / unmatched / failed / ignored / duplicate, or equivalent consistent enums
- `failureReason` and safe error metadata
- `attemptCount`, `lastAttemptAt`, `processedAt`, timestamps
- linked `candidateId` and `applicationId` when available

Required constraints:

- Unique idempotency constraint on mailbox identity + UIDVALIDITY + UID.
- Where safe and useful, a unique constraint/index for non-null Message-ID scoped to mailbox, but account for malformed or absent Message-ID.
- Candidate deduplication uses the existing organization-scoped normalized email behavior.
- Job Codes remain globally unique.
- Application creation must be safe if the worker crashes between candidate creation, resume storage, application creation, and status update.

Implement processing as an idempotent state machine. Use database transactions for relational writes. Storage operations are not part of a PostgreSQL transaction, so implement compensating cleanup/retry behavior for orphaned uploads or failed DB commits. Do not claim true cross-system atomicity. If concurrent workers can claim the same message, use an atomic claim/lease or equivalent locking approach.

### Duplicate application policy

Read the existing application model and Phase 3 behavior before making a decision. Preserve the documented one-application-per-candidate-per-job policy if that is what the schema enforces. If an incoming email represents a duplicate submission for an existing candidate/job, record the inbound email as a duplicate linked to the existing application, avoid redundant resume uploads and avoid creating duplicate candidates/applications. If current code has a different explicit policy, document it and add tests before changing it.

## 5. Match the job and establish tenant relationships

For each incoming message:

1. Persist or claim the inbound message so it cannot disappear.
2. Extract/normalize the Job Code.
3. Look up the job by exact global `jobCode`.
4. Verify job status and any requirements for accepting applications. If closed/unpublished behavior is not defined, document the chosen rule and test it; never accidentally treat a closed job as active.
5. Read `organizationId` and `clientId` from the matched job—not from the email and not from an untrusted payload.
6. Parse candidate name, email, phone and location only from known PyjamaHR email structure. Use robust fallback handling. If required candidate details cannot be parsed, retain the inbound record as failed/unmatched for review rather than inventing data.
7. Identify/normalize candidate email and find or create the organization-scoped candidate using the existing ApplicationService patterns.
8. Validate attachment allowlist, size, MIME type, extension and magic bytes using the existing storage service or a shared validator.
9. Upload the resume to private Supabase Storage using a unique object path scoped to the resolved organization/candidate/application. Do not reuse user-provided filenames as the storage path.
10. Create or reuse the application record, starting at `Applied` when newly created. Set `jobId`, `candidateId`, `organizationId`, `clientId`, `jobCode`, source (e.g. `PyjamaHR email`), and applied timestamp consistently according to the existing schema.
11. Link the inbound record to the candidate/application, persist a success state and append an activity log entry.
12. Ensure the job pipeline, recruiter applicant list and client dashboard use the same persisted `Application` data and tenancy checks.

Use a single shared business service for candidate/application creation where feasible, so public form submissions and email ingestion cannot diverge in data integrity rules. Do not expose private resume URLs in API responses; use the existing authorized signed-URL endpoint.

## 6. Unmatched Applications queue

Add a restricted recruiter/admin view and API endpoint for unmatched/failed inbound records, subject to the security model. Because the mailbox is shared and a Job Code may be missing, an unmatched message may not yet have an `organizationId`. These records must not be visible to arbitrary client users or ordinary users from unrelated organizations.

Minimum capabilities:

- List/search/filter by status, date, normalized Job Code and failure reason.
- View safe metadata and extracted applicant details; do not expose arbitrary raw email HTML by default.
- Display clear reasons such as `no_job_code`, `job_code_not_found`, `ambiguous_job_code`, `parse_failed`, `resume_invalid`, `storage_failed`, or `database_failed`.
- Allow an authorized platform-level administrator to assign an unmatched message to a specific job after explicitly confirming organization/client scope.
- Assignment must verify that the selected job exists and is valid. Then re-run the same idempotent processing service; do not implement a separate weaker code path.
- Provide retry for retryable failures and mark resolved/ignored with a reason and audit entry.
- Never expose a cross-tenant message or resume through guessed IDs. Return 404 or an equivalent non-disclosing result for unauthorized requests.
- Do not delete unmatched records simply because a recruiter marks an email ignored.

If a full UI cannot be completed safely in this phase, implement the protected APIs, document the UI gap honestly, and do not mark the whole feature complete.

## 7. Resume attachment processing

Reuse `StorageService` from Phase 3. Keep the `resumes` bucket private.

- Support PDF, DOC and DOCX per the current product requirements and MIME policy.
- Enforce the existing 10 MB limit before buffering large payloads where feasible; also enforce a limit during streaming/parsing to prevent memory exhaustion.
- Validate file signatures as well as extensions and MIME metadata.
- Sanitize display filename and use server-generated object keys.
- Do not assume a resume is safe solely because its header is valid. Document that antivirus scanning is a production hardening item if no scanner is installed.
- Missing/invalid attachment must not silently drop the application. Follow a documented policy: retain a failed/reviewable inbound record and permit retry or manual resolution; don't report successful resume ingestion when no resume was persisted.
- Ensure retries do not upload a new object on every attempt. Track the object path and clean up orphaned uploads safely.

## 8. IMAP processing state machine and retry behavior

Design a documented transition model such as:

`pending -> processing -> matched | unmatched | duplicate | failed | ignored`

- Distinguish permanent problems (unknown code, no code, invalid attachment) from transient problems (network timeout, database outage, storage outage).
- Retry transient failures with bounded exponential backoff.
- Persist attempts, retry timing and safe error details.
- Failed messages remain visible and retryable.
- An unhandled exception must not mark a message as completed.
- A worker crash during processing must leave a recoverable lease/status; expired processing leases should be reclaimable.
- Process messages in bounded batches and avoid parallelism that can cause resource exhaustion.
- On graceful shutdown, stop accepting new work and finish or release the current message safely.
- If the chosen library updates IMAP flags, explain how this relates to database state. The database idempotency record is the source of truth; don't depend only on `\Seen` flags.

## 9. Security requirements

- No credentials or real email addresses committed to the repo.
- Do not use `SUPABASE_SERVICE_ROLE_KEY` in frontend code. The worker may use a server-only key where necessary for private storage, but it must remain server-side and follow least privilege as far as the selected architecture permits.
- Every authenticated unmatched-queue endpoint must enforce role and tenant access.
- Only a platform-level administrator may assign an inbound message with unknown tenant ownership. If the existing role model intentionally delegates this to organization managers, define an explicit secure claim/assignment process; never permit a manager to seize an email belonging to another known tenant.
- Verify all job, candidate, application and resume relationships from the database, not request body IDs alone.
- Redact email and candidate PII from routine logs.
- Validate all incoming bodies and path parameters with Zod.
- Keep public application rate limits intact; do not weaken them to support email ingestion.

## 10. Automated tests required

Add/extend unit, API and worker tests. Do not rely only on mocks for claims involving PostgreSQL guarantees.

At minimum test:

1. Extract code from a supported PyjamaHR subject.
2. Fallback to body when subject has no code.
3. Normalize lowercase/spacing/dash variants.
4. `JOB-1005` does not match `JOB-10050`.
5. No code creates a persisted unmatched record.
6. Unknown code creates a persisted unmatched record.
7. Multiple distinct codes become ambiguous/unmatched.
8. Exact matching resolves the correct globally unique job.
9. Candidate tenant/client fields are derived from the matched job.
10. A successful email creates/reuses candidate, creates/reuses application, stores resume privately, writes activity, and links the ingestion record.
11. Invalid/missing/oversize resume remains visible and doesn't claim success.
12. Reprocessing the same mailbox/UIDVALIDITY/UID creates no duplicate candidate, application or storage object.
13. Same UID under a different UIDVALIDITY is handled correctly as a distinct mailbox event, with Message-ID/content dedupe applied according to documented policy.
14. Same candidate applying to different jobs creates separate applications and one reusable person profile within the organization.
15. Duplicate candidate/job application follows the documented duplicate policy.
16. Transient database/storage/IMAP failures are retryable.
17. Restart during processing safely resumes/reconciles the message.
18. Concurrent workers cannot create duplicate processing for one message.
19. Unauthorized users cannot list unmatched messages, assign them, retry them or obtain resume links.
20. A client cannot access another client's application/resume.
21. Existing Phase 0–3 tests still pass.
22. Existing type-check and production builds still pass.

Where a test requires actual PostgreSQL sequences, unique constraints, transactions, storage or IMAP, distinguish mock/unit results from integration tests. Do not state a live integration was verified unless it was actually run with a test environment.

## 11. Observability

Provide structured events for:

- mailbox connected/disconnected
- message detected
- Job Code extracted/not found/ambiguous
- job matched/not found
- candidate/application created/reused
- resume validated/uploaded/failed
- ingestion matched/unmatched/failed/duplicate
- retry scheduled/completed

Include a stable event/correlation ID and timing where useful. Never log auth tokens, credentials, raw resumes, or full raw body text.

Expose a restricted health/status endpoint for worker operational state if the current architecture supports it. It should not expose mailbox passwords, full email addresses or message contents.

## 12. Configuration and setup docs

- Update `.env.example` with blank IMAP settings and explanations.
- Document Supabase Storage requirements and private bucket configuration.
- Document how to run the worker locally, how to test with a dedicated mailbox, and how to stop it safely.
- Provide a sample sanitized test email and attachment fixture; do not check in real applications or real resumes.
- Document recovery/retry procedures for failed/unmatched messages.
- Add migration instructions using the repository's established migration history. Do not apply both the same migration manually and through Prisma without reconciliation.
- Never overwrite an existing `.env` file.

## 13. Verification commands

Run the repository's actual scripts and report exact results, at minimum:

- Prisma validate/generate
- `npm run typecheck`
- `npm test`
- `npm run build`
- database migration status or a migration dry-run where available
- integration tests against a dedicated test Supabase project only when credentials are present

If no IMAP mailbox credentials are configured, implement and test against deterministic fixture messages and clearly state that live IMAP verification remains pending. Do not fake successful live mailbox connectivity.

## 14. Completion report

Update `docs/IMPLEMENTATION_PLAN.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `docs/SECURITY_MODEL.md` only where appropriate. Update `docs/DECISIONS.md` if you make a new persistent architectural decision.

At the end, report:

1. Files changed.
2. Actual worker lifecycle and run commands.
3. Database migrations created and whether they were applied to real Supabase.
4. Unit tests, integration tests, typecheck and build results with exact counts.
5. Which tests were mocked vs live.
6. Unresolved issues and production risks.
7. Confirmation that phases 0–3 remain intact.
8. The next phase recommendation.

Do not mark Phase 4 complete if the unmatched record flow, idempotency, private resume handling, and restart recovery are missing. Do not start Phase 5 until the acceptance criteria pass.

---

# Definition of done

The core external application workflow is considered done only when this can be demonstrated end to end:

1. Create and publish a job in HiredeskHR and obtain its permanent Job Code.
2. Send a sanitized test application email into the configured shared mailbox that contains this code and a valid test resume.
3. Worker records the inbound message, extracts the exact code, resolves the correct job and organization, safely creates/reuses the candidate, creates/reuses the application, uploads the resume privately, and links all records.
4. Candidate appears in the correct job's recruiter applicants/pipeline list and on the correct client's dashboard.
5. Authorized user can open the resume through the backend's authenticated signed-download flow; public/unauthorized users cannot.
6. An email with no Job Code, an unknown code, an ambiguous code, or an invalid resume is recorded and visible for remediation; no relevant application silently disappears.
7. Reprocessing the same email, restarting the worker, or recovering after a transient failure creates no duplicate application, candidate or resume object.
8. Data survives restart and organization/client isolation tests pass.
9. Automated test suites, typecheck and production build pass; live-integration limitations are honestly reported.

Implement this phase carefully and incrementally. Protect data integrity over speed of implementation.
