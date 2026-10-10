# HiredeskHR — Antigravity Master Prompt: Phase 5
## Recruiter Dashboard, Candidate Profiles, Pipeline Progression & Activity History

You are continuing work in the existing HiredeskHR monorepo. Phases 0–4 are reported complete. Do not recreate the project or replace the architecture. This phase builds on the current code and data model.

## Important context and operating rules

Before changing code, read these documents and inspect the actual implementation:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/DECISIONS.md`

Also inspect the existing Prisma schema and migrations, the application/candidate/job/inbound services and routes, Supabase Auth middleware, current frontend navigation and APIs, and all tests. The Phase 4 report claims 88 automated tests passed and live Supabase DB/Storage checks passed; rerun the repository checks first and report their actual results.

**Do not rewrite existing modules, rename working endpoints, replace the visual design system, or implement future phases as part of this task.** Preserve the current monorepo conventions, existing job/apply/ingestion services, shared Zod contracts, Auth/RBAC middleware, and private resume storage model. Make only changes needed for Phase 5.

Use the existing package versions and scripts. Never fabricate test results. Clearly separate mocked/unit tests from tests performed against a configured Supabase environment. Do not expose credentials, access tokens, private resumes, or applicant PII in logs.

## Phase 5 objective

Deliver a real, database-backed recruiter dashboard and usable candidate/application workflow:

1. Dashboard metrics derived from database records.
2. Candidate profile with personal data, resumes, application history and activity timeline.
3. Per-job pipeline that lists applications grouped by stage.
4. Secure stage transitions that persist to PostgreSQL.
5. StageHistory and ActivityLog entries for important actions.
6. A hard separation between recruiter-internal notes and client-visible notes.
7. Correct organization/client isolation on every API and resume access.

This is not a UI-only task. All functions must use real API/database data. Do not show fake counts, placeholder applicants, fabricated history or fake AI scores.

---

## 1. Baseline checks

Before coding, run and record:

```powershell
npm run typecheck
npm test
npm run build
```

Inspect the output, `git status`, current migrations and test coverage. If a baseline command fails, identify whether it is pre-existing before editing. Do not delete or weaken tests just to make them pass.

Confirm the existing API and web ports from configuration. Do not assume ports or hardcode alternate ones.

## 2. Schema and migration review

Review whether `StageHistory` and `ActivityLog` (or equivalent existing models) already exist. Reuse existing models if their semantics meet the requirements. If additions are needed, create a versioned Prisma migration; do not only edit `schema.prisma` or use an untracked manual SQL change.

An application stage history entry should include, as appropriate to the existing model:

- Stable ID
- `organizationId`
- `applicationId`
- `fromStage` (nullable for creation)
- `toStage`
- `changedByUserProfileId`
- Timestamp
- Optional reason/comment that is safe for the intended audience

Activity entries should support:

- Stable ID and timestamp
- `organizationId`
- Actor user/profile ID (nullable for system actions)
- Action name
- Entity type and entity ID
- Structured details that do not include secrets or resume contents
- Visibility/audience field or equivalent policy if required to distinguish internal activity from client-visible events

Use foreign keys and indexes. Never allow a normal user to create history entries on behalf of another actor by supplying an arbitrary `changedBy` value. The server determines the actor from the authenticated request. For email-ingestion/system actions, use an explicit system actor convention supported by the schema.

Migration acceptance:

- Migration applies cleanly to the development/test database.
- Existing records remain intact.
- Appropriate indexes exist for organization, application, stage and timestamp queries.
- Regenerate Prisma Client and verify the schema.

## 3. Dashboard metrics API

Implement or refine a protected endpoint such as `GET /api/analytics/dashboard` (or follow the existing canonical analytics route if one exists). Do not create competing duplicate endpoints unnecessarily.

Return real server-computed counts scoped to the authenticated user's permitted organization/client scope. Include metrics supported by the existing schema and PRD:

- Total jobs
- Active/published jobs
- Draft jobs
- Closed jobs
- Total unique candidates in the permitted scope
- New/recent applications with a documented timeframe
- Counts by application stage (including shortlisted, interview, selected and hired)
- Jobs approaching deadline
- Recent activity, with only the fields the caller may see

Rules:

- Define whether counts are application counts or unique candidate counts. Use accurate labels in the UI.
- Keep the date/time window for “recent” and “approaching deadline” in one documented server-side rule, and use UTC/database timestamps consistently.
- Calculate metrics using database queries/aggregations, never frontend hardcoded arrays or demo data.
- Avoid leaking other organizations' or clients' aggregate counts.
- For client accounts, provide only explicitly permitted client-facing metrics or reject the endpoint if that matches the documented access model.
- Add pagination/limits to recent activity and other potentially large responses.
- Return stable zero values and empty arrays when there is no data.

Tests must prove cross-tenant metrics cannot leak, an empty database returns honest zeros, and counts change when jobs/applications/stages change.

## 4. Candidate profile API

Build on the existing `Candidate` and `Application` domain model. Do not merge Candidate and Application into one record: one person can apply to multiple jobs, and each application has its own stage and history.

Add/refine endpoints for:

- Listing candidates or applications for a job, with pagination and stage filtering.
- Fetching a candidate profile.
- Fetching an application detail view with its job, stage, submission date, source, application answers and history.
- Fetching the same person's applications across jobs, but only inside the caller's authorized organization scope.
- Adding notes with explicit visibility (`internal` versus `client_visible`) and server-side authorization.
- Listing activity/history in chronological order.
- Accessing a resume using the existing authorization and short-lived signed URL or secure streaming approach.

Follow the existing API naming conventions and avoid duplicating endpoints if equivalent ones already exist.

Data integrity:

- Application job, candidate and organization must all agree.
- Derive `organizationId` and `clientId` from trusted database relationships, not request payloads.
- Do not expose internal notes, recruiter-only feedback, internal user details or system diagnostics to client users.
- Avoid exposing raw storage keys or permanent public resume links.
- Do not log candidate email, phone, resume content, or signed URL tokens unnecessarily.

## 5. Pipeline API and stage transitions

Implement a real per-job pipeline driven by `Application` records. The UI may be Kanban/drag-and-drop or stage-grouped columns, but it must work with keyboard-accessible controls as well as drag-and-drop if drag-and-drop is implemented.

Use the stages already defined in the project/domain specification, checking existing enum spelling before changing anything:

- Applied
- Screening
- Shortlisted
- Interview
- AI Interview
- Client Review
- Selected
- Hired
- Rejected
- Withdrawn

Do not silently rename existing enum values or break persisted data. If the existing schema uses normalized enum values, map them to display labels in one shared layer.

Implement a stage-change endpoint, using existing route conventions, that:

1. Requires authentication.
2. Checks role, organization, job and client access.
3. Validates the requested stage with a shared Zod schema.
4. Loads the current application and confirms the caller can modify it.
5. Performs the update in a database transaction.
6. Inserts a StageHistory record and corresponding ActivityLog record in the same transaction.
7. Returns the updated application and stage.
8. Prevents invalid state or unauthorized transitions according to a documented transition policy.

Keep transition rules explicit and test them. Do not block normal workflow transitions without a requirement. Client users should not be able to make recruiter-only stage changes. If clients can shortlist/reject/request interviews under the current product specification, implement those as narrow, explicit actions that record client feedback and do not grant general stage-management permissions.

If two stage changes race, use a safe strategy (transaction/optimistic concurrency) so history and current stage never disagree. Preserve every completed transition in history; do not overwrite history records.

## 6. Recruiter UI

Build/refine the existing dashboard and candidate screens using the existing frontend components and design tokens.

Dashboard:

- Summary cards backed by dashboard API values.
- Clear loading, empty, error and retry states.
- Recent applications/activity with permitted fields only.
- Jobs nearing deadline based on real data.
- Clicking a metric or list item should navigate to the corresponding relevant filtered view where a route exists.

Pipeline:

- Select/open a job and view candidate applications grouped by stage.
- Show stage totals and clear empty columns.
- Show candidate name, application date and appropriate non-sensitive summary fields.
- Allow authorized recruiters/managers to change stages.
- Show a confirmation/loading state and update the UI only after server success, or optimistically update with rollback on failure.
- Avoid stale counts after stage updates.
- Provide accessible non-drag controls for moving an application.

Candidate/application profile:

- Candidate identity and contact information, with sensitive fields shown only to authorized users.
- Applications across permitted jobs.
- Resume preview/download using protected access.
- Application stage and stage history timeline.
- Notes separated into internal and client-visible areas according to role.
- Activity history with chronological timestamps.
- Empty and error states; no invented sample records.

Do not rebuild the entire navigation or redesign unrelated pages.

## 7. Authorization matrix

Audit and test these cases explicitly:

- `super_admin`: platform-wide access to authorized administration and platform metrics.
- `manager`: access only to their own organization; manage permitted jobs, applications and stage changes.
- `recruiter`: access only to their own organization and permitted recruitment functions.
- `client`: access only to their assigned client and the jobs/candidates/applications assigned to that client; no internal notes; no unrestricted stage transitions.

For every endpoint, test:

- No token -> 401.
- Invalid or expired token -> 401.
- Disabled or missing profile -> denied.
- Cross-organization record -> non-disclosing 404 or documented equivalent.
- Cross-client record -> non-disclosing 404 or documented equivalent.
- Role not allowed to perform action -> 403.

Never trust a `role`, `organizationId`, `clientId`, `changedBy`, or storage path sent by the browser.

## 8. Testing requirements

Add tests for at least:

1. Dashboard metrics use database results, not hardcoded data.
2. Empty organization returns zero metrics and no fake activity.
3. Organization-level dashboard isolation.
4. Client-level dashboard isolation.
5. Correct unique-candidate vs application counts.
6. Pipeline groups each application into its current stage.
7. Stage transition persists to the database.
8. StageHistory and ActivityLog are created atomically with the transition.
9. A failed transaction does not change the stage or leave orphan history.
10. Invalid stage rejected with a validation error.
11. Client cannot make recruiter-only stage transitions.
12. Recruiter cannot access another organization’s application.
13. Client cannot view internal notes.
14. Client cannot access another client’s resume.
15. Resume URL creation is authorized and time-limited.
16. Same candidate's different job applications each have independent stages.
17. Concurrent/conflicting stage changes are handled safely.
18. Pagination and filtering work and do not leak records.
19. Existing Phases 0–4 tests continue to pass.

Mock external services in unit tests. Include real Supabase integration tests only when running against an explicitly configured test project. Never run destructive tests against production data. Report mocked and live verification separately.

## 9. Verification commands

Run the repository-supported equivalents of:

```powershell
npm run typecheck
npm test
npm run build
```

Also run Prisma validation and migration checks using the existing package scripts. Confirm all earlier tests still pass. If live integration tests were not possible, state exactly which checks remain unverified.

## 10. Documentation and completion report

Update:

- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DATA_MODEL.md` if schema changes are made
- `docs/SECURITY_MODEL.md` if authorization policy changes
- `docs/ACCEPTANCE_TESTS.md` with new dashboard, profile and stage-transition tests
- `docs/DECISIONS.md` for any meaningful architectural decision

Do not mark Phase 5 complete if key criteria are unimplemented or tests are skipped without disclosure.

At completion, report:

1. Files changed and why.
2. Migrations added and how they were applied.
3. Endpoints implemented/modified.
4. Dashboard and pipeline UI behavior.
5. Exact test counts/results by workspace.
6. Type-check/build results.
7. Which tests were mocked versus live against Supabase.
8. Any remaining bugs/security risks.
9. Git commit hash if committed.
10. Recommended next phase only after the acceptance criteria pass.

## Definition of done

Phase 5 is done only when the dashboard is data-backed, application stages persist correctly, stage history and activity are trustworthy, candidate and resume access is scoped correctly, internal notes are hidden from clients, and all existing tests/builds remain green. Do not begin advanced AI Recruiter or reporting features in this phase.
