# HiredeskHR — Architectural Decision Records (ADRs)

## ADR-001: Monorepo Structure with npm Workspaces
- **Status**: Accepted
- **Context**: The platform consists of a React frontend (`apps/web`), an Express REST API (`apps/api`), an IMAP email ingestion daemon (`apps/worker`), a Prisma database layer (`packages/database`), and common validation contracts (`packages/shared`). We need shared types and atomic versioning without complex tooling.
- **Decision**: Use standard npm workspaces. All packages declare internal dependencies using `"@hiredesk/*": "*"` workspace protocols.
- **Consequences**: Fast local linking, single `npm install` at root, straightforward CI scripting.

---

## ADR-002: Express API as the Central Business Logic & Authorization Gateway
- **Status**: Accepted
- **Context**: Supabase Auth provides identity tokens (JWT). While Supabase offers direct client-to-database queries via PostgREST, recruiting agency workflows involve complex multi-tenant routing, client portal restrictions, email ingestion bridging, and strict data auditing.
- **Decision**: The browser client talks to Supabase Auth only for login/logout/session tokens. All data reads and mutations must route through `apps/api` (Express). The backend validates the JWT, resolves `UserProfile`, and enforces RBAC and tenant scoping.
- **Consequences**: Zero risk of frontend filtering vulnerabilities. Direct database connections or service-role keys are never exposed to the client.

---

## ADR-003: Atomic PostgreSQL Sequence for Global Job Code Generation
- **Status**: Accepted
- **Context**: Jobs must have stable, human-readable codes (e.g. `JOB-1001`) that recruiters paste into PyjamaHR / job boards. Calculating the next code via `SELECT COUNT(*) + 1` or finding max ID in application code causes race conditions and duplicate codes under concurrent creation.
- **Decision**: Use a dedicated PostgreSQL sequence `job_code_seq` starting at 1001. Generation occurs atomically in SQL (`'JOB-' || nextval('job_code_seq')`).
- **Consequences**: Guarantees strict global uniqueness and zero race conditions. Immutability enforced by database trigger or API service restrictions.

---

## ADR-004: Strict Entity Decoupling: Candidate vs. Application
- **Status**: Accepted
- **Context**: A candidate might apply for a "Senior Backend Developer" job today and a "Tech Lead" job next quarter. Merging them into a single entity tied to a single job prevents multi-job tracking.
- **Decision**:
  - `Candidate` represents the physical applicant (deduplicated by `normalizedEmail` within the agency organization).
  - `Application` represents the job-specific hiring funnel instance (`candidateId`, `jobId`, `stage`).
  - Unique constraint on `(jobId, candidateId)` ensures repeat submissions for the exact same job are handled idempotently.
- **Consequences**: Clean candidate talent history while keeping job pipeline stages completely independent.

---

## ADR-005: Standalone Persistent Worker for IMAP Ingestion
- **Status**: Accepted
- **Context**: IMAP IDLE requires maintaining an open TCP socket connection over TLS to receive instant push notifications of incoming mail. Ephemeral serverless functions (e.g. AWS Lambda, Vercel) terminate after short timeouts and cannot maintain persistent IMAP connections.
- **Decision**: Implement `apps/worker` as a standalone Node.js process using `imapflow` and `mailparser`. Idempotency is guaranteed by tracking `(mailboxId, uidValidity, uid)` and `messageId` in `InboundApplication`.
- **Consequences**: Requires persistent container/process execution (e.g., Docker, PM2, or persistent VM/Fly/Render).

---

## ADR-006: Private-Only Resume Storage with Short-Lived Signed URLs
- **Status**: Accepted
- **Context**: Resumes contain highly sensitive personal information (full names, phone numbers, addresses, employment history). Public storage bucket URLs allow unauthorized enumeration and data leaks.
- **Decision**: Store resumes in a private Supabase Storage bucket (`resumes`) under randomized UUID paths (`resumes/{organizationId}/{candidateId}/{uuid}.{ext}`). Access is restricted to an authorized backend API route (`GET /api/applications/:id/resume`) that checks permissions and either streams the file or issues a short-lived (60-second) signed URL.
- **Consequences**: Impossible to access resumes without an active, authorized agency or client session.

---

## ADR-007: Authorization-Aware Prisma Scoping & Defense-in-Depth
- **Status**: Accepted
- **Context**: Prisma connects to PostgreSQL using connection pooling credentials that bypass standard Postgres RLS policies unless specifically configured with tenant transactions.
- **Decision**: Implement centralized authorization helpers in `apps/api/src/services`. Every Prisma query MUST explicitly include `organizationId: req.user.organizationId` (and `clientId: req.user.clientId` for client role). PostgreSQL RLS is enabled as a secondary defense layer for direct Supabase connections.
- **Consequences**: Transparent, testable authorization logic in code, backed by extensive negative isolation unit and API tests.
