# HiredeskHR — Phase 9: Release Readiness, End-to-End Acceptance, Security Audit & Deployment

## Mission

The planned feature phases 0–8 are reported complete. This phase is **not a feature-building phase**. Audit the complete HiredeskHR repository and prepare it for a controlled staging release. Verify the full recruitment workflow, external integrations, tenant isolation, data recovery, operational safety and documentation. Fix confirmed defects that block the MVP or create high security/data-loss risk. Do not add new product modules.

## Non-negotiable working rules

1. Start by reading `README.md` and all relevant files in `docs/`, especially `PRODUCT_SPEC.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SECURITY_MODEL.md`, `IMPLEMENTATION_PLAN.md`, `ACCEPTANCE_TESTS.md`, and `DECISIONS.md`.
2. Inspect the current Git status and recent commits. Do not overwrite user changes, drop data, reset the database, or rewrite the project.
3. Run and record baseline commands before making changes: `npm run typecheck`, `npm test`, `npm run build`, and `git diff --check` (adapt only if the repository scripts differ and document why).
4. Treat all previous completion reports as claims to verify, not proof. Label results as **unit/mock**, **local integration**, **live staging integration**, **manual/unverified**, or **blocked by missing credentials**.
5. Never show, paste, log, commit or place credentials in the browser bundle. Never commit `.env` files. Do not ask the user to paste secrets into chat. If actual credentials are needed, use the already configured local environment and do not echo values.
6. Never use real candidate personal data or real resumes in test runs. Use synthetic fixtures and clearly identify any existing records before touching a live database.
7. Do not run destructive schema changes, clean up live tables, send real candidate emails, or change DNS/deployment without explicit confirmation.
8. Preserve existing working features and the stack. Implement only changes justified by a finding. Document significant decisions in `docs/DECISIONS.md`.
9. If any test fails, diagnose it. Never report a command as passed unless its exit code and output support that claim.

## Workstream A — Full-system baseline and dependency health

- Inspect root and workspace `package.json` scripts, dependency versions, lockfile consistency, TypeScript settings, Vite configuration and workspace references.
- Run formatting/static checks that actually exist; do not claim a linter ran if no lint script exists.
- Inspect dependency audit output if it can be obtained safely. Distinguish direct vulnerabilities from transitive ones and explain whether fixes are breaking. Do not blindly force-upgrade core dependencies.
- Confirm production builds do not bundle server secrets, `.env` contents, service-role keys, database URLs, SMTP credentials or IMAP credentials.
- Confirm error responses do not expose stack traces, SQL details, tokens or provider secrets.
- Confirm logs redact credentials, authorization headers, sensitive email content and resume text.
- Confirm CORS is restricted to configured origins, security headers are enabled, rate limits exist on public endpoints, and request-body/file-size limits are enforced.
- Verify API and worker processes support graceful shutdown and surface readiness/health status correctly.

## Workstream B — End-to-end core acceptance test

Run the critical workflow defined in `docs/ACCEPTANCE_TESTS.md` against a **dedicated staging Supabase project** when configured. Use synthetic data only. If staging is not configured, complete the fixture-based/local tests and produce a clearly marked manual staging checklist.

Required workflow:

1. Sign in using a valid Supabase Auth test account and confirm profile/role resolution.
2. Create a staging organization and client through the authorized setup path.
3. Create a job and verify its global Job Code is generated atomically and remains immutable.
4. Publish the job and verify only public fields appear in the public career page.
5. Submit a synthetic public application with a valid sample resume.
6. Confirm Candidate, Application, Resume metadata, activity and storage object are linked correctly.
7. Process a synthetic inbound email containing the exact Job Code and a sample resume through the same worker processor used by IMAP.
8. Verify missing, unknown and ambiguous Job Codes are persisted in the unmatched queue rather than silently discarded.
9. Verify the candidate appears in the correct recruiter pipeline and corresponding client portal.
10. Open/download the resume only after authorized access; confirm anonymous and cross-client access is denied.
11. Move an application through allowed stages and verify StageHistory and ActivityLog are persisted atomically.
12. Verify client feedback, shortlist/reject permissions and interview request/scheduling states.
13. Configure a test SMTP sink or safe test mailbox when available. Verify email delivery against the sink/provider response; do not send to real candidates. Ensure failures remain visible and retry behavior is safe.
14. Verify notification creation and idempotency for each wired event.
15. Verify analytics values against direct SQL results for the same synthetic dataset.
16. Verify Talent Pool membership does not create duplicate candidate people or alter job-specific applications.
17. Verify AI matching output is traceable, deterministic fallback is clearly labelled when no provider is set, and the AI cannot automatically reject or advance applicants.
18. Restart API and worker. Verify applications, stages, resumes, notifications and processed-email identifiers persist and no duplicate side effects occur.
19. Clean up only test records that this test created, and only if cleanup is known to be safe and documented. Preserve pre-existing records.

For every step, report its status and evidence. A mocked test does not satisfy a live staging acceptance step.

## Workstream C — Tenant isolation and permissions audit

Create a permission matrix for `super_admin`, `manager`, `recruiter`, and `client`. Review every protected route and service, including jobs, applications, candidate profiles, resume URLs, inbound applications, pipeline, notes, interviews, calendar files, outbound communication history, Talent Pool, notifications, analytics, settings and admin operations.

Test at least:

- Unauthenticated access returns 401 where required.
- Unknown, disabled or unmapped users cannot access application data.
- A recruiter/manager cannot access another organization's resources by changing IDs, Job Codes, slugs, filters or pagination parameters.
- A client cannot access another client's jobs, candidate profiles, applications, resumes, interview details, notifications or activity.
- Client-safe DTOs exclude recruiter-only notes, private storage paths, raw inbound message payloads, secrets and internal diagnostics.
- A client cannot change reviewer identity, organizationId, clientId, role, ownership, stage outside allowed transitions, or internal notes by manipulating request bodies.
- Public endpoints expose only published job information and apply validation/rate limiting.
- Resume links expire and cannot be reused beyond their configured lifetime; access checks occur before generating a link.
- Bootstrap/admin endpoints cannot be claimed or replayed by an ordinary user.
- SMTP retries, inbound retries, manual reassignments and notification creation are authorization-checked and auditable.

Audit the actual database connection and Supabase RLS posture. Clearly document where Prisma uses privileged credentials and where application-level authorization is the enforcement point. Do not claim RLS protects privileged Prisma queries if the configured database role bypasses policies. Validate Storage policies and least privilege. Flag unresolved issues rather than describing security as perfect.

## Workstream D — Database, migrations and data integrity

- Inspect `packages/database/prisma/schema.prisma`, all Prisma migration files, `supabase/migrations`, and migration history.
- Identify duplicate or out-of-sync migration paths. Document one authoritative migration workflow; do not run both SQL and Prisma schema-push blindly.
- Validate a clean database can be provisioned from committed migration files without manual hidden steps.
- Confirm global Job Code and Candidate Code generators are database-atomic, unique under concurrent inserts, and never reused due to record counts. Validate Job Code immutability at the database layer.
- Confirm foreign keys and unique constraints for tenant relationships, candidates, applications, inbound-email identifiers, notifications and outbox jobs.
- Check orphaned relation risks, transaction boundaries, partial failure cleanup, object-storage/database consistency, and retry idempotency.
- Review sequence naming/schema qualification so migrations and runtime queries refer to the same sequence.
- Do not alter or reset the live database merely to make a test pass. Any required production migration needs a documented backup and rollback plan.

## Workstream E — External integrations and configuration truthfulness

For each integration, give one status: **live verified**, **configured but not verified**, **fixture/mock only**, **not configured**, or **blocked**.

Audit:

- Supabase Auth and session verification.
- Supabase PostgreSQL connectivity and migrations.
- Supabase private Storage upload, signed URL and deletion behavior.
- Hostinger IMAP connection, mailbox permissions, UIDVALIDITY handling, reconnect, backoff and graceful shutdown.
- SMTP delivery, provider acceptance, retry behavior, permanent failures and outbox reconciliation.
- `.ics` generation, timezone handling, rescheduling sequence and cancellation method.
- Any purported direct Google Calendar, Microsoft/Outlook, AI provider or job-board integration.

Do not describe `.ics` import as direct two-way calendar sync. Do not claim the real IMAP mailbox is connected unless it was tested using configured credentials. Do not claim AI-provider results when the deterministic fallback ran.

## Workstream F — Data privacy, backup and recovery

- Document the personal data handled: candidate name/contact details, resumes, application answers, feedback, interviews and communication metadata.
- Check that no real resume data appears in source fixtures, screenshots, logs, reports or test outputs.
- Define retention/deletion behavior for candidates, resumes, applications, inbound emails and outbound communications; flag any policy that still needs an owner decision.
- Document separate backup/recovery procedures for PostgreSQL and Supabase Storage objects. Database backups alone do not prove resume-object recoverability.
- If safe non-production backup/restore verification is available, test it; otherwise provide a clearly marked manual runbook.
- Document how to rotate compromised credentials and revoke sessions without disclosing secrets.
- Do not claim regulatory compliance without a completed, appropriate assessment.

## Workstream G — Deployment and operations runbook

Create or update `docs/RELEASE_READINESS.md` with:

1. Required services and versions.
2. Exact environment variable **names**, descriptions and which service consumes them (never values).
3. Local development start commands for web, API and worker.
4. Staging provisioning and migration commands, including the correct order.
5. How to run unit tests, integration tests, type-checks and production build.
6. Safe deploy order for API, web and worker; include compatibility notes for schema changes.
7. Health/readiness verification and key operational logs/metrics.
8. IMAP disconnection, failed inbound item, SMTP outage, storage failure and database failure recovery procedures.
9. Database and object-storage backup/recovery notes.
10. Rollback steps and a list of operations that must never be run casually against production.
11. Unresolved manual steps, required accounts/credentials and external service configuration.
12. Go/no-go checklist with named evidence for every criterion.

Add `.env.example` updates only for missing variable names/descriptions. Verify `.env` and secret files are ignored by Git. Do not commit real secret values.

## Workstream H — Defect triage and implementation boundaries

Prioritize findings:

- **P0:** Data loss, cross-tenant exposure, authentication bypass, public private-resume exposure, duplicate or corrupted state, broken core acceptance workflow.
- **P1:** Failed core user actions, migration/recovery hazards, outbound email state reported inaccurately, worker restart/retry failures.
- **P2:** Noncritical usability/operability issues.

Fix only reproducible P0/P1 defects that are in scope and safe to change. Add regression tests. Record any deferred finding, impact, workaround and owner decision needed. Avoid cosmetic redesign and new features during this phase.

## Required final deliverables

- `docs/RELEASE_READINESS.md` — deployment, recovery and go/no-go runbook.
- `docs/SECURITY_AUDIT.md` — finding list with severity, evidence, affected routes/files, fix status and remaining risk.
- Updated `docs/ACCEPTANCE_TESTS.md` with the actual release-gate status.
- Updated `docs/IMPLEMENTATION_PLAN.md` reflecting tested reality, not aspirations.
- Any necessary regression tests and limited code fixes.

## Definition of done

Phase 9 is complete only when:

- Baseline and final type-check/tests/build commands have recorded, truthful exit statuses.
- The test environment is clearly identified (unit/mock, local, live staging).
- Core acceptance steps are passed or explicitly blocked with named missing prerequisites.
- Cross-tenant and client permission checks have evidence, not just code inspection.
- Migrations can be applied using one documented authoritative procedure.
- No secret leak or known unresolved P0 issue remains.
- P1 findings are fixed or explicitly documented with a safe release decision.
- Backup/recovery and deployment runbooks are written.
- Working tree and Git diff are inspected; no secrets, test artifacts containing personal data or accidental unrelated changes are committed.

At the end, produce a concise release-gate report containing: exact commands and exit codes, unit-test totals, live staging test totals, untested integrations, security findings by severity, migration status, required manual setup, and a clear recommendation of **GO TO STAGING**, **NO-GO**, or **READY FOR PRODUCTION REVIEW**. Do not use “production ready” simply because builds and mocks pass. Do not deploy, change DNS, modify billing, or run destructive cleanup without explicit user approval.
