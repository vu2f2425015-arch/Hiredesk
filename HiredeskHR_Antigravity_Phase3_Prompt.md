# HiredeskHR — Phase 3 Antigravity Build Prompt
## Candidates, Applications, Resume Storage & Public Apply Flow

Copy the **MASTER PROMPT** below into Antigravity with the existing HiredeskHR repository open.

---

# MASTER PROMPT — PHASE 3

Continue development in the existing HiredeskHR monorepo. Phase 0 (architecture/scaffold), Phase 1 (Supabase Auth and tenant authorization), and Phase 2 (Jobs CRUD, atomic global Job Codes, and public career views) are reported as complete.

## Non-negotiable working rules

1. Before changing code, inspect the current repository and read:
   - `docs/PRODUCT_SPEC.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATA_MODEL.md`
   - `docs/SECURITY_MODEL.md`
   - `docs/IMPLEMENTATION_PLAN.md`
   - `docs/ACCEPTANCE_TESTS.md`
   - `docs/DECISIONS.md`
   - `packages/database/prisma/schema.prisma`
   - current Jobs routes/service/tests and the public career page.
2. Treat the actual code and schema as authoritative for what exists. Do not blindly trust previous status reports.
3. Preserve the monorepo, Supabase Auth, Express API, Prisma/PostgreSQL, shared Zod contracts, structured logger, and existing UI patterns. Do not rewrite Phase 0–2.
4. Implement **Phase 3 only**. Do not implement IMAP ingestion, AI Recruiter, interviews, billing, or advanced reports in this phase.
5. Do not introduce hardcoded/dummy candidate records, fake applicant counts, pretend successful uploads, or stub success responses.
6. Never place Supabase service-role/secret keys or database credentials in frontend code, public environment variables, Git, logs, or responses.
7. Make small, reviewable changes. Run tests, type checks and builds. Fix regressions before finishing.
8. If Supabase credentials are unavailable, complete safe local tests and clearly mark live integration tests as not run. Never claim unrun tests passed.

## Phase 3 objective

Make the public application lifecycle real and safe:

`Published Job → Public Application Form → Validated Resume Upload → Candidate Record → Job-specific Application (Applied) → Recruiter can view candidate/application`

The same person may apply to multiple jobs. Reuse their person-level candidate record inside the same organization, but create a separate application for every distinct job application. Candidate identity and job-specific state must not be collapsed into a single row.

## 1. Audit and finalize the data model

Review the existing Prisma schema before editing. Reuse equivalent fields and relations where possible. Do not create duplicate concepts under different names.

Ensure the model supports these concepts:

### Candidate (person-level)
- Internal UUID primary key.
- Organization ID.
- Candidate code if already in the agreed data model.
- Name, normalized email, original/display email, phone, location/country where available.
- Optional extracted profile information, skills and experience only when genuinely supplied or parsed.
- Created/updated timestamps.
- Unique constraint on `(organizationId, normalizedEmail)`.

Email normalization for matching must be conservative: trim surrounding whitespace and lowercase the address. Do not remove plus-address tags or otherwise rewrite provider-specific email semantics.

### Application (job-specific)
- Internal UUID primary key and a stable application identifier if defined in the project contract.
- Organization ID, candidate ID, job ID, client ID if the existing architecture stores this denormalized value, and immutable Job Code snapshot only if the existing schema requires it.
- Initial stage `Applied`.
- Source such as `career_page`.
- Applied/created/updated timestamps.
- Application answers where applicable.
- Resume relationship(s) associated with this application.
- Unique/idempotency strategy to prevent the same public submission from creating duplicate application rows on retries.

All foreign-key and tenant relationships must be consistent. The authoritative job link is `Application.jobId → Job.id`; the Job Code is an external identifier, not a replacement for the foreign key.

### Resume metadata
Store resume bytes in Supabase Storage, not in PostgreSQL. Store only metadata in the database:
- UUID, organization ID, candidate ID, application ID.
- Original filename for display (sanitized).
- Private storage path/key (never a public URL).
- Verified MIME type, file size, uploaded timestamp.
- Optional file hash and parse status if consistent with the existing design.

Support one or multiple resumes per application only if the UI/data model is clear; do not overwrite a previous application’s resume when the same person applies to another job. Preserve foreign keys and appropriate indexes.

### Migration rules
- Update Prisma schema and create a versioned migration; do not silently reset the database or delete existing data.
- Use a migration workflow consistent with the repository. `prisma db push` alone does not preserve custom SQL objects such as sequences or triggers; preserve/reapply the Phase 2 `job_code_seq` and Job Code immutability trigger through migrations.
- Validate schema/migrations before proceeding.

## 2. Public job application API

Review the Phase 2 public career endpoints. Keep their response shapes compatible unless a documented change is necessary.

Implement an application endpoint, for example:
- `POST /api/career/:orgSlug/jobs/:jobCode/applications`

The exact path can follow repository conventions, but document it and test it.

Requirements:
- Public applicants do not need an account to apply.
- Resolve the organization by its public slug and the job by the globally unique Job Code; verify that the job belongs to that organization.
- Only accept applications to a published job belonging to an active organization. Draft and closed jobs must not accept submissions.
- Validate required application fields on the server with shared Zod schemas.
- Do not trust organization ID, client ID, job ID, stage, source, or role supplied by the browser. Derive them from the resolved server-side organization/job.
- Set initial stage to `Applied` on the server.
- Set source to `career_page` on the server.
- Derive client ID from the job where applicable.
- Return a minimal confirmation response; never return other candidates, internal notes, internal IDs not needed by the public page, storage keys, or stack traces.
- Use consistent error response envelopes and appropriate HTTP status codes.
- Never fall back to fuzzy/title matching if Job Code/slug resolution fails.

## 3. Resume upload validation and storage

Implement secure resume upload for the public application form.

Accepted formats in this phase: PDF and DOCX. Maximum size: 10 MB. If DOC is already a documented MVP requirement, support it safely too; do not claim DOC works if it is not implemented and tested.

Validation must occur on the server. Do not rely only on the browser's `accept` attribute or supplied MIME type.

Requirements:
- Enforce maximum file size (10 MB) before fully buffering large uploads where practical.
- Check extension, declared MIME type and file signature/container structure as appropriate; reject mismatches and unsupported types.
- Sanitize the original filename for display and generate a random storage filename/key to prevent path traversal and collisions.
- Use a private Supabase Storage bucket such as `resumes`.
- Upload via the server using a secret key kept server-side; never expose that key to the browser.
- Do not create publicly readable resume URLs.
- Persist metadata and the private storage path only.
- Generate short-lived signed URLs only after the backend has verified the requesting user is authorized to access that candidate/application.
- For a public upload in progress, no signed download URL should be returned to the anonymous applicant unless an explicit secure product requirement is documented.
- Handle partial failures: if storage upload succeeds but the database transaction fails, clean up the orphaned storage object where possible and log a safe error. If the database write succeeds but subsequent processing fails, preserve a recoverable record rather than silently losing the application.
- Do not log resume contents, signed URLs, access tokens, or sensitive personal data.

Add configuration/setup documentation for the private bucket and required environment variables without real credentials.

## 4. Candidate deduplication and application idempotency

Implement server-side, organization-scoped candidate deduplication:

1. Normalize the submitted email conservatively.
2. Find or create a Candidate using `(organizationId, normalizedEmail)`.
3. If the candidate exists, reuse the profile. Do not overwrite existing non-empty profile data with blanks.
4. Create a separate Application for the selected job.
5. Attach the newly submitted resume and answers to that application.
6. Prevent duplicate applications from repeated HTTP retries using an idempotency token/key or a robust server-side submission identity. Validate keys and enforce the relevant uniqueness at the database level.
7. Handle concurrent submissions safely. Avoid race conditions in find-then-create flows; use database constraints and retry/re-read logic for uniqueness conflicts.
8. Do not merge the same email across different organizations.
9. Do not block the same person from applying to a different job in the same organization.
10. Define and test what happens if the same person submits the same job form twice. Prefer a safe duplicate-prevention response over creating repeated applications unintentionally.

If a uniqueness conflict occurs, handle it gracefully rather than returning an internal server error.

## 5. Public form and UI

Extend the existing Phase 2 public career view rather than creating a second, conflicting implementation.

Required behavior:
- Career page lists only published jobs for an active organization.
- Job detail displays only public fields.
- A clear Apply action opens a usable form.
- Form includes appropriate applicant details (at least full name and email) and resume upload; add phone and other fields when consistent with the existing application schema.
- Display supported formats and the 10 MB limit.
- Validate input in the browser for usability and again on the server for security.
- Show clear loading, validation, upload, success and error states.
- Prevent accidental repeated clicks/submissions while a request is in progress.
- Success confirmation should not reveal internal tenant IDs, database details or the resume storage key.
- The recruiter Jobs UI must show applicant counts derived from actual Application rows, not Candidate row counts or hardcoded numbers.
- If an applications/candidates view already exists, integrate real records into it; do not build placeholder lists.
- Keep the current design system and responsive behavior. Avoid unrelated redesigns.

## 6. Recruiter access and resume download

Implement or refine minimal authenticated endpoints for viewing applications/candidates relevant to Phase 3. Follow existing route conventions.

Requirements:
- Recruiter/manager sees only applications in their own organization.
- Client users see only applications tied to jobs assigned to their client; provide only the fields appropriate for client review.
- A client must never get access to another client’s candidate/application/resume.
- Super-admin access follows the documented platform role policy.
- All access checks happen server-side, not just in the UI.
- Resume access endpoint must verify organization, application, candidate, and client scope before issuing a short-lived signed URL.
- Do not accept an arbitrary storage path from the caller and sign it blindly.
- Return a non-disclosing 404 or consistent forbidden response for out-of-scope resources according to the existing security policy.

Do not mark the whole Client Dashboard feature complete just because an endpoint exists; connect real database-backed applications to the existing UI only to the extent required by this phase.

## 7. Rate limiting and abuse protection

Public submission endpoints must be rate-limited. Use the repository’s existing middleware/library if present; otherwise add a small, maintained dependency appropriate to Express.

- Apply limits to application submissions and large file uploads.
- Validate text lengths and file size.
- Add a simple honeypot or equivalent low-friction spam control only if it can be implemented without harming accessibility.
- Avoid leaking whether a candidate email already exists in the database.
- Do not add CAPTCHA or external services unless the project explicitly needs them.

## 8. Testing requirements

Add tests for at least:

### Data and relationships
1. Candidate is created for a new email.
2. Same email in the same organization reuses the candidate profile.
3. Same email in another organization creates a separate candidate.
4. Same candidate applying to a different job creates a distinct application.
5. Application starts at `Applied` and source is server-assigned as `career_page`.
6. Application points to the exact job ID resolved by Job Code and organization.
7. Job’s applicant count uses Applications and remains correct when a candidate has multiple applications.
8. Concurrent submissions do not produce broken duplicate candidate records.
9. Idempotent retry does not create duplicate application/resume records unintentionally.

### Job/public access
10. Published job accepts an application.
11. Draft job rejects applications.
12. Closed job rejects applications.
13. Unknown Job Code returns the expected public error; no title-based fallback occurs.
14. A Job Code from another organization cannot be submitted through the wrong organization slug.
15. Inactive organization/job is not exposed for public application.

### Files/security
16. Valid PDF under 10 MB is accepted.
17. Valid DOCX under 10 MB is accepted.
18. File above 10 MB is rejected.
19. Unsupported extension/type is rejected.
20. MIME/extension spoofing is rejected where detectable.
21. Unsafe filenames are sanitized; storage keys are random and safe.
22. Resume bucket remains private and public reads are denied.
23. Unauthenticated users cannot fetch resumes or request signed resume URLs.
24. Recruiter from another organization cannot fetch/download a resume.
25. Client cannot fetch another client’s application or resume.
26. Unauthorized callers cannot request arbitrary storage paths.
27. Storage failure leaves no misleading successful application response.
28. Database failure after upload triggers cleanup/recovery handling.
29. Rate limiting prevents submission floods and returns a consistent response.

### Regression and build
30. All Phase 0, Phase 1, and Phase 2 tests still pass.
31. Prisma schema validation and client generation pass.
32. Type-check passes.
33. Production build passes.
34. Run full unit/API tests. Run live Supabase/Storage tests only when valid test credentials are configured, and accurately report skipped integration tests.

Use mocks/fakes for unit tests where appropriate, but do not describe mock storage or mock database tests as live Supabase verification.

## 9. Documentation

Update:
- `docs/DATA_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `.env.example` and relevant app README files

Document:
- Schema and migration applied.
- Supabase private bucket name and setup procedure.
- Required server-only vs browser environment variables.
- Public application endpoint and request/response shape.
- Accepted resume types and size limit.
- Idempotency/deduplication rules.
- How to test the public application path locally.
- Which security/integration tests were actually executed and which remain unverified.

Never write actual secret values into documentation.

## 10. Completion report

At the end, give a concise report with:
1. Files changed.
2. Database migration created and exact apply command.
3. Supabase Storage configuration required.
4. Public application API contract.
5. Tests run, with exact pass/fail/skip counts.
6. Type-check/build results.
7. Known limitations and unresolved risks.
8. Confirmation that no Phase 4 IMAP ingestion was started.
9. Git commit hash if committed successfully.

Do not claim Phase 3 is complete if required tests fail or live configuration is missing. Do not proceed to Phase 4 automatically.

---

# Suggested execution order

Ask Antigravity to implement in these small checkpoints rather than one giant edit:

1. **Schema and migration:** Candidate/Application/Resume model audit, migrations, uniqueness constraints and generated client. Run Prisma validation first.
2. **Backend service and APIs:** Candidate deduplication, application creation, Storage integration, secure signed URL handler and rate limiting.
3. **Public UI:** Apply form and real submission flow integrated with existing public career routes.
4. **Recruiter view and counts:** Connect real application data and ensure counts query Applications, not Candidates.
5. **Tests, security review and documentation:** Run full checks; fix every regression; report accurately.

Do not skip a checkpoint if it fails. Review the schema migration and security boundaries before allowing the agent to continue to the next checkpoint.
