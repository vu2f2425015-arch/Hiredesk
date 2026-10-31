# HiredeskHR — Multi-Tenant Recruitment Agency ATS

HiredeskHR is a multi-tenant Applicant Tracking System (ATS) project for recruitment agencies managing hiring pipelines across multiple client companies. It is deployed as a demonstration environment; production readiness requirements are tracked in the release-readiness document.

---

## Key Differentiators & Features

1. **Strict Multi-Tenancy**: Isolated agency organizations with secure, dedicated client portals.
2. **Stable Job Code Bridge**: Sequence-driven global Job Codes (`JOB-1001`) that bridge job board aggregators (e.g., PyjamaHR -> LinkedIn) with incoming application emails.
3. **Automated IMAP Ingestion**: Dedicated Node worker parsing inbound emails, normalizing Job Codes, deduplicating candidates, and filing applications idempotently.
4. **Zero-Mock Policy**: All dashboard counts, pipelines, and metrics are computed directly from real database queries.

---

## Monorepo Architecture

```text
hiredeskhr/
├── apps/
│   ├── web/               # React + Vite + TypeScript frontend
│   ├── api/               # Express + TypeScript central API gateway
│   └── worker/            # IMAP email ingestion service (imapflow + mailparser)
├── packages/
│   ├── database/          # Prisma schema & client (@hiredesk/database)
│   └── shared/            # Shared enums, types, and Zod schemas (@hiredesk/shared)
├── docs/                  # Architecture, specs, data models & decision records
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── SECURITY_MODEL.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── ACCEPTANCE_TESTS.md
│   └── DECISIONS.md
├── .env.example           # Environment variables template
└── package.json           # npm workspaces root configuration
```

---

## Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your Supabase PostgreSQL database URL and credentials.

### 3. Build & Typecheck
```bash
npm run build
npm run typecheck
```

### 4. Run Test Suites
```bash
npm test
```

### 5. Start Development Servers
```bash
# In separate terminal sessions:
npm run dev:api     # Express API on http://localhost:4000
npm run dev:web     # React Vite web on http://localhost:5173
npm run dev:worker  # IMAP Ingestion Worker
```

---

## Current project status

The repository includes the recruiter dashboard, job and application pipelines, public career pages, client portal, inbound email worker, interviews and communications, talent pool, analytics, notifications, and AI-assisted recruiter endpoints.

The public deployment is a demonstration environment. Its API health route confirms that the API process responds; it does not currently report database connectivity, email worker status, or SMTP delivery status. Do not treat the landing-page/API health indicator as a production readiness or data-protection certification.

See [Release Readiness](docs/RELEASE_READINESS.md) for the current deployment checks and remaining pilot requirements. Build, typecheck, and test commands above are instructions; their results should be recorded with a date and commit whenever they are run.

