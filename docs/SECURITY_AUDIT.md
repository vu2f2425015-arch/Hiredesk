# HiredeskHR — Security Audit & Isolation Architecture Report

## 1. Executive Summary

This Security Audit covers the architecture, multi-tenant isolation boundaries, role-based access control (RBAC), data leakage protections, storage security, and external integration surfaces of **HiredeskHR**.

| Security Pillar               | Verification Status | Residual Risk Level | Notes                                                                                |
| :---------------------------- | :------------------ | :------------------ | :----------------------------------------------------------------------------------- |
| **Authentication & RBAC**     | **VERIFIED**        | **LOW**             | Server-side Supabase JWT verification; anti-privilege-escalation guards              |
| **Multi-Tenant Isolation**    | **VERIFIED**        | **LOW**             | Strict `organizationId` scoping enforced across all service queries                  |
| **Client Role Isolation**     | **VERIFIED**        | **LOW**             | Non-disclosing 404 responses prevent resource discovery or cross-client leaks        |
| **Internal Notes Redaction**  | **VERIFIED**        | **ZERO**            | `recruiterNotes` stripped from ClientPortal DTOs and API responses                   |
| **Resume & Storage Access**   | **VERIFIED**        | **LOW**             | Private bucket; 60s short-lived signed URLs; storage paths redacted from client DTOs |
| **Inbound Email Idempotency** | **VERIFIED**        | **LOW**             | Multi-layer deduplication verified with genuine replay tests                         |
| **Public Endpoint Defense**   | **VERIFIED**        | **LOW**             | Rate limiting active on career application endpoints (20 req / 15m)                  |
| **Secrets & Operations**      | **VERIFIED**        | **LOW**             | Zero secrets in git or client bundle; default bootstrap secret blocked in production |

---

## 2. Vulnerability Findings & Remediation

### Finding Overview

| Finding ID  |   Severity   | Category         | Title                                                          |     Status     |
| :---------- | :----------: | :--------------- | :------------------------------------------------------------- | :------------: |
| **SEC-001** |   **HIGH**   | Authentication   | Default `BOOTSTRAP_SECRET` allowed in production               |   **FIXED**    |
| **SEC-002** |  **MEDIUM**  | Data Integrity   | Subject job title mismatch not logged during inbound ingestion |   **FIXED**    |
| **SEC-003** |  **MEDIUM**  | Operations       | Gmail App Password whitespace parsing fragility                |   **FIXED**    |
| **SEC-004** |   **LOW**    | Architecture     | Primary multi-tenancy enforced at application layer, not RLS   | **DOCUMENTED** |
| **SEC-005** |   **INFO**   | Testing          | Synthetic test data clarification vs live relay                | **DOCUMENTED** |
| **SEC-006** | **CRITICAL** | Authentication   | Unsafe password overwrite during registration conflict         |   **FIXED**    |
| **SEC-007** |   **HIGH**   | Authentication   | Premature email verification bypass in public registration     |   **FIXED**    |
| **SEC-008** |  **MEDIUM**  | Data Integrity   | Controlled cleanup of partial registration failures            |   **FIXED**    |
| **SEC-009** |   **HIGH**   | Web Security     | Permissive CORS fallback and wildcard Vercel origin exposure   |   **FIXED**    |
| **SEC-010** |  **MEDIUM**  | Defense-in-Depth | Registration rate limiting, password bounds & role locking     |   **FIXED**    |

---

### Detailed Findings

#### SEC-001: Default `BOOTSTRAP_SECRET` Allowed in Production (HIGH — FIXED)

- **Affected Route**: `POST /api/bootstrap/super-admin` ([apps/api/src/routes/bootstrap.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/routes/bootstrap.ts#L25-L35))
- **Risk**: If an application was deployed to production with `BOOTSTRAP_SECRET` unset or left as `'hiredesk-local-bootstrap-secret'`, an attacker could bootstrap a platform `super_admin` account if the database had zero super-admins.
- **Remediation Applied**: Added explicit server-side check refusing bootstrap with default secret when `NODE_ENV === 'production'`:
  ```ts
  if (
    config.NODE_ENV === "production" &&
    config.BOOTSTRAP_SECRET === "hiredesk-local-bootstrap-secret"
  ) {
    logger.error(
      "Refused bootstrap: default BOOTSTRAP_SECRET cannot be used in production environment",
    );
    sendError(
      res,
      "FORBIDDEN",
      "Default bootstrap secret is prohibited in production",
      403,
    );
    return;
  }
  ```
- **Test Verification**: Added targeted negative test in `apps/api/tests/auth.test.ts` verifying that default secrets in production mode are rejected with HTTP 403 Forbidden.

#### SEC-002: Inbound Email Subject Title Mismatch Logging (MEDIUM — FIXED)

- **Affected File**: [apps/worker/src/inboundProcessor.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/worker/src/inboundProcessor.ts#L259-L276)
- **Observation**: In the live test, the message subject was `Application received for Senior Backend Engineer (JOB-1003)`, but `JOB-1003` resolved to `Senior Full Stack Engineer (TypeScript & React)`. Exact job-code matching succeeded, but the discrepancy was silently ignored.
- **Remediation Applied**: Added an audit check comparing subject keywords with the database job title. Preserves deterministic `jobCode` matching without guessing by title, while logging a warning for auditability.

#### SEC-003: App Password Whitespace Fragility (MEDIUM — FIXED)

- **Affected Files**: [apps/worker/src/imapClient.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/worker/src/imapClient.ts#L38-L42), [apps/api/src/services/email.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/services/email.ts#L60-L65)
- **Observation**: Google generates App Passwords in 4-character space-separated groups (`xxxx yyyy zzzz wwww`). Copying the password with spaces caused authentication rejections.
- **Remediation Applied**: Added defensive `.trim().replace(/\s+/g, '')` in IMAP and SMTP auth initializers.

#### SEC-004: Multi-Tenant Scoping at Application Layer vs PostgreSQL RLS (LOW — DOCUMENTED)

- **Architecture Note**: The backend interacts with Supabase PostgreSQL using the Prisma Client with the service role / pooler connection. Because the service role bypasses PostgreSQL Row-Level Security (RLS), multi-tenant isolation relies strictly on the application service layer enforcing `where: { organizationId }` on all queries.
- **Mitigation**: All service methods (`jobs`, `applications`, `clientPortal`, `talentPool`, `interviews`, `analytics`) strictly enforce `where.organizationId = user.organizationId` and `where.clientId = user.clientId`.

#### SEC-005: Synthetic Test Ingestion Clarification (INFO — DOCUMENTED)

- **Audit Note**: The email ingested during the live test was dispatched via SMTP by the test suite to Gmail, formatted according to PyjamaHR's RFC822 relay specifications. It was not sent from PyjamaHR's live mail servers. Testing against actual third-party PyjamaHR mail relays requires a live PyjamaHR agency account.

#### SEC-006: Unsafe Password Overwrite During Registration Conflict (CRITICAL — FIXED)

- **Affected Route**: `POST /api/auth/register` ([apps/api/src/routes/auth.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/routes/auth.ts))
- **Risk**: If a self-registration attempt encountered an existing Supabase Auth email, the legacy handler searched for that account via `listUsers` and invoked `updateUserById` to overwrite the existing user's password and set `email_confirm: true`. This constituted an immediate account takeover vulnerability.
- **Remediation Applied**: Completely eliminated `listUsers` and `updateUserById`. The route now detects Supabase conflict errors (e.g., status 422 / 'already registered') and returns a safe HTTP 409 Conflict without altering or querying the existing account.
- **Regression Test Verification**: `apps/api/tests/authSecurity.test.ts` verified that conflict attempts leave existing accounts untouched with zero calls to `updateUserById`.

#### SEC-007: Premature Email Verification Bypass in Public Registration (HIGH — FIXED)

- **Affected Route**: `POST /api/auth/register` ([apps/api/src/routes/auth.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/routes/auth.ts)), [apps/web/src/context/AuthContext.tsx](file:///c:/MY%20PROJECTS/Hiredesk/apps/web/src/context/AuthContext.tsx)
- **Risk**: Public self-registration passed `email_confirm: true` directly to `admin.createUser`, falsely validating new accounts and bypassing Supabase's email verification guarantees.
- **Remediation Applied**: Removed `email_confirm: true`. Self-registered users default to unconfirmed email status. The API returns `emailConfirmed: false` and `requiresEmailVerification: true`. The web frontend provides explicit guidance to check inboxes for verification links.
- **Regression Test Verification**: `apps/api/tests/authSecurity.test.ts` verifies that `email_confirm` is not passed to Supabase and response metadata correctly reflects unconfirmed status.

#### SEC-008: Controlled Cleanup of Partial Registration Failures (MEDIUM — FIXED)

- **Affected Route**: `POST /api/auth/register` ([apps/api/src/routes/auth.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/routes/auth.ts))
- **Risk**: If Supabase Auth user creation succeeded but the subsequent Prisma transaction failed (e.g. database network interruption or slug conflict), an orphaned Supabase Auth record remained, permanently blocking the user from re-registering.
- **Remediation Applied**: Implemented controlled rollback that tracks whether a new Auth user was created in the current request (`createdNewAuthUser`). If the database transaction fails, `admin.deleteUser` is invoked exclusively for that newly created ID. Pre-existing users can never be deleted or altered.
- **Regression Test Verification**: `apps/api/tests/authSecurity.test.ts` simulates transaction failure and asserts that `admin.deleteUser` cleans up only the newly created Auth user.

#### SEC-009: Permissive CORS Fallback & Wildcard Origin Exposure (HIGH — FIXED)

- **Affected File**: [apps/api/src/app.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/app.ts)
- **Risk**: The CORS middleware permitted any origin matching `*.vercel.app` and fell through to allow all origins on error.
- **Remediation Applied**: Replaced with an explicit allowlist parsed from `config.CORS_ORIGIN`. Unconfigured origins (including wildcard `*.vercel.app` in production) are rejected with HTTP 403 Forbidden (`CORS_ERROR`) with no `Access-Control-Allow-Origin` header emitted. Localhost is restricted exclusively to development and test environments.
- **Regression Test Verification**: `apps/api/tests/authSecurity.test.ts` asserts that unauthorized origins receive 403 Forbidden with headers withheld, and production mode rejects unconfigured Vercel subdomains.

#### SEC-010: Registration Rate Limiting, Password Bounds & Role Locking (MEDIUM — FIXED)

- **Affected Files**: [apps/api/src/routes/auth.ts](file:///c:/MY%20PROJECTS/Hiredesk/apps/api/src/routes/auth.ts), [packages/shared/src/schemas/auth.ts](file:///c:/MY%20PROJECTS/Hiredesk/packages/shared/src/schemas/auth.ts)
- **Risk**: `/api/auth/register` had no IP rate limiting, potentially allowing automated brute-force account creation; passwords lacked an upper boundary check; role parameters could theoretically be injected.
- **Remediation Applied**: Mounted `authRegisterLimiter` (10 requests per 15 min per IP, skipped in test). Updated `RegisterUserSchema` with max 128 character password bound and whitespace rejection. Hardcoded `UserRole.MANAGER` in the database transaction, strictly preventing self-assignment of `SUPER_ADMIN`.
- **Regression Test Verification**: `apps/api/tests/authSecurity.test.ts` verifies that payloads attempting `{ role: 'super_admin' }` are constrained strictly to `manager`.

---

## 3. Role-Based Access Control (RBAC) Verification

HiredeskHR enforces 4 discrete roles:

1. **`super_admin`**: Platform administrator (agency onboarding, platform settings).
2. **`manager`**: Agency manager (agency-wide candidate sourcing, client company management, analytics).
3. **`recruiter`**: Agency recruiter (job publishing, pipeline progression, candidate communication, talent pool management).
4. **`client`**: Client hiring manager (reviewing shortlisted candidates, submitting candidate feedback, requesting interviews).

### Privilege Escalation Protections

- **Self-Role Modification**: User profiles cannot be modified by users; there is no profile update endpoint exposing role/organization fields.
- **User Provisioning**: `POST /api/admin/users` strictly forbids non-`super_admin` callers from creating `super_admin` users (returns 403 Forbidden).
- **Tenant Lock**: Agency managers can only provision users within their own `organizationId`. Client users are strictly pinned to their `clientId`.

---

## 4. Multi-Tenant & Cross-Client Isolation Audit

### Tenant Scoping Across Service Layers

| Module              | Recruiter / Manager Scope           | Client Role Scope                             | Cross-Tenant Protection               |
| :------------------ | :---------------------------------- | :-------------------------------------------- | :------------------------------------ |
| **Jobs**            | Filtered by `organizationId`        | Filtered by `clientId` + `status = PUBLISHED` | Returns 404 (non-disclosing)          |
| **Applications**    | Filtered by `organizationId`        | Filtered by `clientId`                        | Returns 404 (non-disclosing)          |
| **Recruiter Notes** | Visible & editable                  | **Completely redacted from response**         | Cannot read or write (403)            |
| **Talent Pool**     | Full access within `organizationId` | **Completely denied (403 Forbidden)**         | Client access blocked at entry        |
| **Interviews**      | Full access within `organizationId` | Filtered to own jobs via `/client-portal`     | Cannot access other client schedules  |
| **Analytics**       | Scoped to agency `organizationId`   | Scoped to own `clientId`; draft jobs excluded | Zero cross-client data in aggregation |
| **Resumes**         | Accessible via 60s signed URL       | Accessible via 60s signed URL                 | Storage path redacted from DTO        |

---

## 5. Resume and Storage Security

1. **Storage Bucket**: Private bucket (`resumes`) configured in Supabase Storage.
2. **File Validation**:
   - Max file size: 10 MB limit enforced via Multer and service layer.
   - Allowed extensions: `.pdf`, `.docx`, `.doc`.
   - Magic bytes verification: Validates binary file signatures (`%PDF-`, `PK\x03\x04`, `0xD0 0xCF 0x11 0xE0`) to prevent MIME-spoofing attacks.
   - Filename sanitization: Strips path traversal characters (`..`, `/`, `\`) and non-alphanumeric characters.
3. **Signed URLs**:
   - Expiration: Short-lived (60 seconds).
   - Authorization: Required before URL generation; cross-tenant download requests return 404.
4. **DTO Redaction**:
   - `storagePath` and `bucket` are removed from `ClientPortalApplicationDtoSchema`. Clients only receive `{ id, originalFilename, fileSize, contentType, uploadedAt }`.

---

## 6. Inbound Email Ingestion & Genuine Replay Audit

Multi-layer deduplication and idempotency was verified via `test_inbound_replay_idempotency.mjs`:

```
Layer 1: Mailbox Lease Check   --> @@unique([mailboxId, uidValidity, uid]) in inbound_applications
                                   (Replay of same message returns claimed = false)

Layer 2: Terminal Short-Circuit --> processInboundEmail immediately exits if status === MATCHED | DUPLICATE
                                   (Zero re-parsing or database writes)

Layer 3: Candidate Dedup        --> @@unique([organizationId, normalizedEmail]) in candidates
                                   (Reuses existing candidate; zero duplicate candidate profiles)

Layer 4: Application Dedup      --> @@unique([jobId, candidateId]) in applications
                                   (Detects existing application; marks inbound record DUPLICATE; zero resume re-uploads)
```

### Genuine Replay Test Results

- **Test 1 (Same Message UID Replay)**: Lease claim refused (`claimed = false`). Record status remained `matched`.
- **Test 2 (Terminal Short-Circuit)**: Re-invoking `processInboundEmail` exited immediately with `status = matched`.
- **Test 3 (Re-sent / Forwarded Application with new UID)**:
  - Inbound status: `duplicate` (failure reason: `duplicate_application`).
  - Candidate count in Org: Unchanged (1 = 1).
  - Applications for `JOB-1003`: Unchanged (1 = 1).
  - Resumes in Storage / DB: Unchanged (1 = 1).

---

## 7. Web Security & Secrets Audit

- **Tracked Secrets**: `git ls-files` confirmed zero `.env`, credentials, or password files are tracked in source control.
- **Git Ignore**: `.gitignore` strictly ignores `.env`, `apps/worker/.env`, `*password*.txt`, and `*credentials*.txt`.
- **HTTP Headers**: `helmet()` active on all API endpoints.
- **CORS**: Strict production allowlist validated against `config.CORS_ORIGIN`. Unconfigured origins (including wildcard `*.vercel.app` in production) are rejected with HTTP 403 Forbidden (`CORS_ERROR`). Localhost is permitted only in development/test environments.
- **Rate Limiting**:
  - `/career/:orgSlug/jobs`: 100 requests per 15 minutes.
  - `/career/:orgSlug/jobs/:jobCode/applications`: 20 requests per 15 minutes.
  - `/api/auth/register`: 10 requests per 15 minutes (per IP, skipped in test).
- **Error Handling**: Central error handler suppresses error stacks and database internals when `NODE_ENV === 'production'`.

---

## 8. Audit Verification Summary

| Check                          | Tool / Suite                          |              Result               |
| :----------------------------- | :------------------------------------ | :-------------------------------: |
| **API Unit & Security Tests**  | Vitest (`apps/api/tests`)             |    **170 / 170 Passed (100%)**    |
| **Worker Ingestion Tests**     | Vitest (`apps/worker/tests`)          |     **25 / 25 Passed (100%)**     |
| **Shared Contracts Tests**     | Vitest (`packages/shared/tests`)      |      **3 / 3 Passed (100%)**      |
| **Total Automated Tests**      | Monorepo Suite (`npm test`)           |    **198 / 198 Passed (100%)**    |
| **Workspace Typecheck**        | TypeScript 5.7 (`tsc --noEmit`)       |   **0 Errors (5/5 workspaces)**   |
| **Genuine Replay Suite**       | `test_inbound_replay_idempotency.mjs` | **100% Passed (Zero duplicates)** |
| **Live Inbound Processing**    | `test_live_gmail_inbound.mjs`         |          **100% Passed**          |
| **Mail Services Verification** | `verify_mail_services.mjs`            |          **100% Passed**          |

---

## 9. Final Launch Determination

### **Controlled Pilot Deployment: GO (APPROVED)**

The platform is cleared for a controlled staging pilot with 1 agency and 1 client partner. Tenant isolation, resume security, authentication boundaries, and duplicate prevention are verified.

### **Public Production Deployment: NO-GO (BLOCKED)**

The platform is **NOT** cleared for unauthenticated public domain onboarding until:

1. **Production Domain & CORS**: Configure real frontend/API domains and update `CORS_ORIGIN` from `http://localhost:5173`.
2. **Supabase Auth Redirects**: Whitelist production callback URLs in Supabase Auth settings.
3. **Rotate Bootstrap Secret**: Set a unique, high-entropy `BOOTSTRAP_SECRET` in the production environment.
4. **Git Remote & CI/CD**: Attach remote git repository and configure deployment pipelines.
