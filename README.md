# HiredeskHR — Multi-Tenant Recruitment Agency ATS

HiredeskHR is a real, production-minded Applicant Tracking System (ATS) engineered specifically for recruitment agencies managing hiring pipelines across multiple client companies.

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

## Phased Development Roadmap

- [x] **Phase 0 — Monorepo Scaffold & Standards** (Active)
- [ ] **Phase 1 — Supabase Auth, Profiles & Tenant Authorization**
- [ ] **Phase 2 — Jobs & Atomic Global Job Codes**
- [ ] **Phase 3 — Candidate, Application & Public Career Portal**
- [ ] **Phase 4 — Email Ingestion Worker & Unmatched Queue**
- [ ] **Phase 5 — Recruiter Dashboard, Candidate Profile & Pipeline**
- [ ] **Phase 6 — Client Portal & Isolation Hardening**
- [ ] **Phase 7 — Interviews & Communications** (Post-MVP)
- [ ] **Phase 8 — Talent Pool, Analytics & Decision Support** (Post-MVP)
