# HiredeskHR — Phase 6 Antigravity Build Prompt
## Client Portal, Client Review Actions & Tenant Isolation Hardening

Paste the full **MASTER PROMPT** below into Antigravity while the existing HiredeskHR repository is open.

---

# MASTER PROMPT — Phase 6

You are continuing development of **HiredeskHR**, an Applicant Tracking System (ATS) for recruitment agencies. Work in the existing repository. Implement **Phase 6 only: the dedicated Client Portal, client review actions, and cross-client security hardening**.

## 0. Mandatory working rules

1. Before changing anything, inspect and follow the current repository's:
   - `docs/PRODUCT_SPEC.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATA_MODEL.md`
   - `docs/SECURITY_MODEL.md`
   - `docs/IMPLEMENTATION_PLAN.md`
   - `docs/ACCEPTANCE_TESTS.md`
   - `docs/DECISIONS.md`
   - Prisma schema and migrations
   - existing authentication middleware, application services/routes, pipeline, notes, resume signing, and dashboard modules.
2. Run the current baseline commands and record the results before editing:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
3. Preserve the existing monorepo, architectural boundaries, styles, API conventions, and working behavior. Do not rewrite previous phases or duplicate existing services/routes.
4. Implement Phase 6 only. Do not start interviews/calendar integration, email automation, AI Recruiter, reports expansion, billing, or other future phases except a minimal persisted interview-request record if required by an explicitly documented design.
5. Do not add fake/demo candidates, fixed dashboard numbers, placeholder-success responses, or mock behavior to production code. Empty database results must display honest empty states.
6. Never write secrets into source code, frontend environment variables, logs, documentation, screenshots, or Git. Never print actual credentials.
7. Do not run destructive database operations or reset the Supabase project. Inspect existing schema and migrations first. Do not use `prisma db push` in place of committed migrations for an established environment unless the repository's documented workflow explicitly requires it.
8. Tests with mocks must be labeled as mocked. Do not claim live security or Supabase integration verification unless it was actually run against a configured test environment.
9. Use small, reviewable changes. After implementation, inspect the diff and check that no unrelated files or temporary test scripts are accidentally committed.

## 1. Phase 6 outcomes

Build a dedicated client-facing portal in the existing React/Vite/TypeScript frontend. A client user must be able to:

- Sign in using the existing Supabase Auth integration.
- See only jobs assigned to the authenticated user's own `organizationId` and `clientId`.
- Open a job and see only applications belonging to that exact client and job.
- Review candidate details approved for clients, including application answers, candidate contact fields permitted by the product policy, application status/history intended for client visibility, and a resume via an authorized short-lived signed URL.
- Submit a client review/feedback entry.
- Shortlist a candidate, reject a candidate, or request an interview only when the request is allowed by the documented workflow.
- See an understandable confirmation or error for each action.

The portal must not reveal internal recruiter notes, platform diagnostics, other clients' records, service-role data, mailbox payloads, resume storage paths, or other internal-only activity.

## 2. Authentication and trusted scope

Use the current Express authentication middleware and its verified `req.user` context. Do not introduce a second auth mechanism.

For every client-facing API operation:

- Require an authenticated, active profile with role `client` unless the existing product contract explicitly allows a manager/recruiter preview route.
- Derive `organizationId` and `clientId` only from the authenticated server-side user profile.
- Never treat a client-supplied `organizationId`, `clientId`, role, or permission as evidence of authorization.
- When a route contains `jobId`, `applicationId`, `candidateId`, or a resume ID/path, resolve it through database relationships constrained to the user's authorized organization and client.
- Prefer a non-disclosing `404` for resources outside the client's scope so IDs cannot be enumerated.
- Keep role checks separate from resource ownership checks; a valid `client` role does not grant access to every client record.
- Check authorization on the server for every read and mutation, including resume URL generation. Frontend hiding is not security.

Inspect the existing code and fix the underlying shared service/query where possible instead of adding only UI-level filters.

## 3. API audit and implementation

Audit the existing endpoints and services, especially:

- `GET /api/analytics/dashboard`
- `GET /api/jobs` and `GET /api/jobs/:id`
- `GET /api/jobs/:id/pipeline`
- `GET /api/applications/:id`
- `PATCH /api/applications/:id/notes`
- `POST /api/applications/:id/stage`
- `GET /api/applications/:id/resume`
- `GET /api/candidates/:id`
- Existing candidate/job application listing and resume signed-URL services.

Maintain existing routes if possible. Add or refine client-specific routes only where current API contracts are insufficient, and document them. Possible routes, only if needed, include:

- `GET /api/client-portal/me` — authenticated client profile/context, with no secrets.
- `GET /api/client-portal/jobs` — jobs belonging to the current client's assigned `clientId` and organization.
- `GET /api/client-portal/jobs/:jobId/applications` — applications only for the verified client's job.
- `GET /api/client-portal/applications/:applicationId` — client-safe application/candidate profile.
- `POST /api/client-portal/applications/:applicationId/shortlist` — client review action if permitted.
- `POST /api/client-portal/applications/:applicationId/reject` — client review action if permitted.
- `POST /api/client-portal/applications/:applicationId/request-interview` — record an auditable interview request if the current schema can represent it safely; do not pretend that a calendar invite or email was sent if interview scheduling is not implemented.
- `POST /api/client-portal/applications/:applicationId/feedback` — add client-visible review feedback.

Validate all input using the existing shared Zod schemas. Use consistent response/error envelopes. Do not return an unrestricted Prisma object; explicitly serialize safe DTOs.

### Important API consistency rules

- Reuse existing service functionality and transaction patterns wherever possible.
- Keep recruiter-only operations and internal notes unchanged for recruiter/manager roles.
- Do not allow the client to edit `recruiterNotes` through any route or nested payload.
- Prevent status changes on closed/deleted jobs or terminal applications where the documented workflow forbids them.
- If client decisions affect application stage, use an explicit server-side transition policy, not an arbitrary `stage` string supplied by the client.
- Record each accepted action with the verified actor, application/job/organization context, timestamp, and action details in `ActivityLog`/`StageHistory` using the repository's existing schema.
- Use database transactions for a state mutation and its audit entries so the stage cannot change without its corresponding history record.
- Return the persisted result, not a success message based on frontend state.

## 4. Client action workflow

Inspect the existing `ApplicationStage` enum and documented lifecycle before implementing these actions. Align with the canonical stage names in the code; do not casually create duplicate or inconsistent stage names.

Implement these behaviors:

### Shortlist

- Only allow the action if the application is in a stage from which client review is allowed under the documented policy.
- Apply the allowed transition to the canonical next stage (typically `Shortlisted` or the agreed client-review stage after reviewing the existing lifecycle).
- Save `StageHistory` and `ActivityLog` atomically.
- Prevent repeated clicks/retries from producing duplicate audit actions when the operation is already complete.

### Reject

- Require confirmation in the UI.
- Require or support a concise rejection reason if consistent with the existing data model; validate it.
- Use the canonical `Rejected` stage and record actor, timestamp, previous stage, new stage, and reason in history/audit.
- Do not delete the candidate, application, or resume.

### Request interview

- Do not claim an interview is scheduled, a calendar is updated, a meeting link exists, or an email has been sent unless those systems are actually implemented and called successfully.
- For this phase, create a persisted, auditable **interview request** associated with the application/client/organization if there is no interview-request entity yet. If adding a model is necessary, make a reviewed Prisma migration and add the corresponding tests.
- Show the client that the request was submitted and show recruiters that there is a pending request. Do not implement full calendar/invitation automation in this phase.

### Feedback

- Save feedback through the backend with validation and tenant scope.
- Client feedback must be client-visible; internal recruiter notes must remain internal.
- Do not overwrite or leak internal recruiter notes when saving feedback.
- Record the feedback action in activity history.

## 5. Dedicated Client Portal UI

Create a dedicated route/view using the current frontend conventions; keep the existing recruiter experience intact.

The portal should include:

1. **Client overview** — concise counts based on real authorized data, plus an honest empty state.
2. **Assigned jobs** — search/filter only within the current client scope, with title, status, deadline, openings where appropriate, and real applicant count.
3. **Applicants per job** — candidate name, applied date, stage, and only information appropriate for client review.
4. **Candidate review view** — client-safe profile fields, resume access, client-visible history and feedback.
5. **Action controls** — Shortlist, Reject, Request Interview, Leave Feedback with validation, loading states, confirmation and visible error handling.
6. **Responsive/accessibility behavior** — keyboard reachable controls, labels, focus management for dialogs, clear status indicators, no reliance on color alone.
7. **Navigation by role** — clients should land in the Client Portal after login; recruiter/manager/super-admin navigation should continue to work. A client must not gain recruiter navigation simply by changing a route.

Do not display fake numbers if the tenant has no records. Do not render internal notes temporarily while the profile is loading; default to no internal data until the server returns an explicitly safe client DTO.

## 6. Resume authorization

Review the entire resume access chain.

- A client may receive a signed URL only after the backend confirms the resume belongs to an application/job that belongs to that same client's `clientId` and organization.
- Never accept arbitrary storage paths from the client as sufficient authorization.
- Signed URLs must be short-lived and generated server-side after authorization.
- Do not expose public resume URLs or bucket contents.
- Ensure the resume endpoint returns a non-disclosing error for another client's resume.
- Do not log signed URLs or resume contents.

## 7. Cross-client and cross-organization security tests

Add a repeatable security test matrix with at least two organizations and at least two clients within one organization. Use unique test fixtures and clean them up safely. Never run destructive cleanup against real user data.

Test at minimum:

1. Client A can list only Client A's assigned jobs.
2. Client A cannot list Client B's applications by changing `jobId`.
3. Client A cannot retrieve Client B's application by changing `applicationId`.
4. Client A cannot retrieve Client B's candidate by changing `candidateId`.
5. Client A cannot generate a signed URL for Client B's resume.
6. Client A cannot shortlist, reject, or request an interview for Client B's application.
7. Client A cannot write feedback to Client B's application.
8. Client cannot read or update `recruiterNotes` through detail, search, pipeline, notes, or alternate payload fields.
9. Client cannot change their own `clientId`, `organizationId`, role, or active status through any profile or review endpoint.
10. A manager/recruiter cannot cross into another organization or client through these new routes.
11. Missing, expired, or invalid authentication is denied.
12. Invalid stage transitions are rejected and do not leave orphaned `StageHistory` or `ActivityLog` rows.
13. Repeated action requests do not create incorrect duplicate state/audit records.
14. Client safe DTOs contain no internal notes, raw email payloads, private storage paths, or privileged metadata.
15. Public application routes remain public where intended, and do not grant access to the client portal.

Add at least one live integration test against a configured test Supabase environment if safe credentials are available. Otherwise mark it as **not run**, and clearly separate it from mocked tests.

## 8. Migrations and database changes

- Inspect current Prisma models and prior migrations first.
- Add a migration only if the current schema cannot represent required persisted review actions/interview requests or audit detail.
- Migrations must be versioned, repeatable through the documented migration toolchain and safe for existing data.
- Do not apply destructive changes, truncate tables, recreate production resources, or reset Supabase.
- Generate Prisma Client after schema changes and validate the schema.
- Do not claim a migration was applied live unless a real successful execution was observed.

## 9. Documentation

Update the relevant sections of:

- `docs/PRODUCT_SPEC.md`
- `docs/SECURITY_MODEL.md`
- `docs/DATA_MODEL.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md` (add an ADR if a meaningful architectural decision was made)

Document the client review rules, safe DTO policy, endpoint permissions, resume authorization chain, and the difference between an interview request and a scheduled interview.

## 10. Verification before completion

Run and report the actual result of:

- Prisma schema validation and client generation, if available.
- `npm run typecheck`
- `npm test`
- `npm run build`
- New cross-client security tests.
- Any live Supabase integration test that is safe and configured.

For any failure, fix it or report it accurately. Do not suppress test output or weaken existing tests to claim success. Re-run the full suite after the final code changes.

Review `git diff --check`, `git status`, and the final diff. Ensure there are no credentials, `.env` files, test fixture data containing real personal information, or temporary scripts accidentally staged.

## 11. Completion report format

At the end, provide:

1. Summary of features implemented.
2. Files created/modified.
3. API endpoints and authorization behavior.
4. Database migrations and whether each was only created, applied locally, or applied to a live test database.
5. Tests run with exact pass/fail/skip counts.
6. A clear separation of mocked tests vs. live integration tests.
7. Any unresolved bugs, limitations, or production risks.
8. Git commit hash if committed.
9. Explicit confirmation that Phase 7 work has **not** begun.

Do not mark Phase 6 complete unless all completion criteria above are met.

---

# Suggested execution checkpoints

If the agent starts trying to change too much at once, work through these checkpoints one at a time:

1. **Audit first:** baseline tests, inspect current role scoping and map every client-facing endpoint/data shape. Do not change code yet.
2. **Backend security:** scope all relevant read/write service functions using trusted `req.user` context; add safe DTOs and cross-client negative tests.
3. **Client actions:** implement transactionally persisted shortlist/reject/feedback/interview-request actions and audit history.
4. **Client UI:** add a dedicated role-based Client Portal using the real APIs and existing design system.
5. **Resume access:** verify the complete authorization chain from route to storage signing.
6. **Full verification:** run all tests, typecheck, build, diff checks, update docs, and report actual results.

**End of prompt.**
