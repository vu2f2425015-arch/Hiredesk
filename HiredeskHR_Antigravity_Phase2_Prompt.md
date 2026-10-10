# HiredeskHR — Antigravity Phase 2 Prompt
## Jobs, Atomic Global Job Codes, CRUD APIs, and Public Job Views

Copy everything in the **MASTER PROMPT** below into Antigravity in the existing HiredeskHR repository.

---

# MASTER PROMPT

Continue implementation in the existing HiredeskHR monorepo. Phase 0 (scaffold) and Phase 1 (Supabase Auth, user profiles, RBAC, tenant authorization, and bootstrap) are reported complete. Before changing code, verify the actual repository state and reproduce the relevant checks; do not assume the prior completion report proves the implementation is correct.

## A. Required initial review

Read these documents first:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/DECISIONS.md`

Inspect the current Prisma schema, migrations, shared Zod contracts, API auth middleware, authorization helpers, error envelope, logging/request ID middleware, React app, workspace scripts, and existing tests. Run the existing test suite, type-check, and build before making changes. Record the baseline results.

Do not rewrite the monorepo, replace established patterns unnecessarily, or start email ingestion, candidate management, interviews, AI, reporting, billing, or unrelated modules in this phase.

## B. Phase 2 goal

Implement the first real Jobs module:

1. Authenticated users can create and manage jobs within their authorized organization.
2. Every job receives a **globally unique, permanent Job Code** such as `JOB-1001`, generated on the server/database side.
3. Job Code generation is concurrency-safe and cannot be chosen or changed by the client.
4. Recruiter/manager users can access only jobs in their organization; client users can see only jobs assigned to their own client and only through explicitly permitted views.
5. Public career endpoints show only published, public jobs and never expose internal metadata.
6. Frontend job lists and forms use real API data; no fake counts or mock job records.

Implement Phase 2 only and update `docs/IMPLEMENTATION_PLAN.md` after tests verify completion.

## C. Data model and Job Code requirements

Inspect the existing schema before modifying it. Reuse equivalent existing fields/models where possible and keep naming consistent with the repository.

The Job model should include, as appropriate to the existing schema:

- Internal UUID `id` as primary key.
- `jobCode` as globally unique, immutable external identifier.
- `organizationId` as required tenant scope.
- `clientId` as required or nullable only if the product specification explicitly permits internal/unassigned jobs; document the choice and enforce it consistently.
- `title`, `department`, `employmentType`, `workplaceModel`, `country`, `currency`.
- Salary range fields with validation rules.
- Experience, openings, deadline, education requirements, required skills, description and key requirements.
- `status` with at least `draft`, `published`, and `closed`.
- Created/updated timestamps and creator/updater identifiers if supported by the current model.

Use PostgreSQL-side concurrency-safe code allocation. Prefer a PostgreSQL sequence or another atomic database mechanism, with the final stable format `JOB-<number>` (e.g. `JOB-1001`). Sequence gaps after failed transactions are acceptable; do not implement a fragile `SELECT MAX(...) + 1` approach. The sequence must be global across organizations, matching the prior architectural decision.

Enforce global uniqueness with a database unique constraint/index. Job Code must be set by trusted server/database logic, not accepted from client input. Make it immutable after insertion using an appropriate database trigger or equivalent database-level enforcement, and add regression tests proving updates cannot change it.

If using a PostgreSQL sequence, handle concurrency correctly. If custom SQL/trigger logic is needed, add it to a versioned Prisma migration rather than relying only on `prisma db push`. Ensure a fresh environment can recreate the database from migrations.

Do not assume all Prisma `String @default(cuid())` IDs or client-side counters are safe Job Code generation methods. Do not promise gapless codes.

## D. Organization, client, and authorization integrity

For every create/update/read/delete operation:

- Derive the acting user from the verified authentication middleware.
- Derive organization scope from the trusted user profile, not from an untrusted request body, query string, or header.
- Verify that the selected `clientId` belongs to the same organization as the actor and job.
- `super_admin` may administer across organizations only through explicitly protected administrative behavior.
- `manager` and `recruiter` may perform permitted job operations only within their own organization.
- A `client` user cannot create, edit, close, reopen, duplicate, or delete jobs unless an explicit product rule grants that capability. For this phase, clients may read only published/active jobs assigned to their own client through the client-safe endpoint/view.
- A caller must not gain access by submitting another organization's UUID or client UUID.
- Return the project's consistent error envelope and suitable HTTP status codes. Where necessary, use 404 for out-of-scope resources to avoid leaking existence.

Important database security note: document the real database connection role and its privileges. Do not claim PostgreSQL RLS protects Prisma operations if the connection role bypasses RLS or policies. Server-side authorization is mandatory. Keep secret/service-role/database credentials on the server only.

## E. API endpoints

Follow existing API prefix, request validation, response, error handling, request ID, and logging conventions. If route names differ in the repository, preserve existing conventions and document the final paths.

Implement at least:

- `POST /api/jobs` — create a job with validated fields; generate Job Code on the trusted server/database side; return the persisted job.
- `GET /api/jobs` — list jobs available to the authenticated recruiter/manager within their organization; support validated search/filter/pagination if the existing shared contracts make this straightforward.
- `GET /api/jobs/:id` — return a job only if the actor is authorized for its organization/client scope.
- `PATCH /api/jobs/:id` — update permitted fields. Never accept `id`, `organizationId`, or `jobCode` as mutable values from the request body. Validate client reassignment, if supported, against the same organization.
- `POST /api/jobs/:id/close` and `POST /api/jobs/:id/reopen`, or use the repository's established status-update convention. Validate allowed transitions.
- `POST /api/jobs/:id/duplicate` only if this can be implemented cleanly in scope. A duplicated job must get a new Job Code generated atomically; it must not copy the original identifier.
- Public endpoint such as `GET /api/career/:orgSlug/jobs` to list only published jobs, plus a public job-detail endpoint if the existing architecture calls for it. Resolve the organization by public slug and return an explicit public DTO that excludes internal IDs/notes, private data, unpublished jobs, and sensitive metadata.

Do not return database objects indiscriminately. Define explicit response DTOs and validate all body, params, query and path inputs with the project's shared Zod schemas.

Define applicant counts as database-derived values. For this phase, if the Application model exists, calculate counts from persisted application records; do not hardcode counts or count candidates where the data model says applications are authoritative. If applications are not implemented yet, omit applicant counts or clearly return zero only where semantically correct—do not fabricate numbers.

## F. Frontend Jobs UI

Implement a working Jobs module in the existing React application, preserving the current design system and navigation style.

Required UI:

- Jobs list backed by `GET /api/jobs`.
- Loading, empty, error and retry states.
- Search/filter controls only where they are backed by real API behavior.
- Create Job form for the defined fields with client-side validation matching server-side Zod rules.
- Successful create shows the server-generated Job Code and a one-click copy action.
- Job detail view showing status, code, title, relevant job data, and permitted actions.
- Edit draft/published job fields without modifying Job Code or organization ownership.
- Publish/close/reopen actions with confirmation where appropriate.
- Public career listing/detail page using public endpoints, not the authenticated private job endpoint.
- Accessible labels, keyboard usability, and clear validation errors.

Do not add demo jobs, fake applicant counts, inert buttons, or UI elements that claim an action succeeded when the API failed. If configuration is missing, show an honest setup error and do not fall back to fake data.

## G. Tests — required before marking Phase 2 complete

Add unit, API/integration, and UI/end-to-end tests consistent with the current test setup. At minimum cover:

1. Authenticated manager/recruiter can create a valid job.
2. Unauthenticated job creation is rejected with 401.
3. Client user cannot create or mutate a job.
4. Recruiter from Organization A cannot read/update/close a job belonging to Organization B.
5. A user cannot attach a job to a client in another organization.
6. A malformed or invalid job payload is rejected with a validation error.
7. Job Code is generated by the trusted server/database, not accepted from client input.
8. Multiple concurrent job creations produce distinct globally unique Job Codes.
9. Job Code is immutable after creation, including attempts using direct database updates.
10. Duplicating a job generates a new code if duplication is included.
11. Public career listing returns published jobs only.
12. Public job detail does not expose private/internal fields or unpublished jobs.
13. Close/reopen transitions are validated and persisted.
14. List/detail responses use database-backed persisted data, not frontend fixtures.
15. Existing Phase 0 and Phase 1 tests remain passing.

Use a real temporary/test PostgreSQL database for sequence/trigger/migration integration tests if available. Mocking a database call is not sufficient proof of concurrency correctness or trigger enforcement. If a test cannot run due to missing external configuration, report it as skipped/unverified rather than passed.

## H. Database migration and local developer setup

- Create a versioned Prisma migration for any schema changes and custom SQL.
- Test applying migrations on a fresh test database when available.
- Update `.env.example` with variable names only, never real credentials.
- Document `DATABASE_URL` and `DIRECT_URL` expectations for Supabase/Postgres, without including passwords.
- Update README setup instructions accurately.
- Never commit `.env`, credentials, service-role keys, generated personal data, or resume files.

## I. Verification checklist

Before reporting completion, run and record exact results for:

- Prisma schema validation and client generation.
- Database migration creation/application where credentials permit.
- Shared schemas build/tests.
- API build/tests.
- Web build/tests.
- Whole-repo `npm run typecheck`.
- Whole-repo `npm test`.
- Whole-repo `npm run build`.
- Concurrency and immutability integration tests against PostgreSQL, or an explicit note that they remain unverified because no test database is configured.

Inspect `git diff` and `git status`; ensure no secrets, unintended unrelated changes, or accidental Phase 3+ work have been introduced. Commit only if the repository's established workflow expects a commit and the changes pass checks.

## J. Completion report format

At the end, provide:

1. Files created/modified.
2. Final database schema and migration details.
3. Final API endpoint list and role rules.
4. Jobs UI behavior implemented.
5. Exact commands run and test/build results.
6. What requires Supabase credentials or manual dashboard setup.
7. Any tests skipped/unverified and remaining risks.
8. Acceptance-test status.
9. Next recommended phase, but do not begin it automatically.

**Do not mark Phase 2 complete merely because the UI renders.** Phase 2 is complete only when the Job Code is generated atomically, persisted jobs work end-to-end, authorization tests pass, public views are correctly restricted, and verification results are honest.

# END MASTER PROMPT
