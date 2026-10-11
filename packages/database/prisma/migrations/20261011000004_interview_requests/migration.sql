-- Migration 20261011000004_interview_requests: Add interview_requests table

CREATE TABLE IF NOT EXISTS "interview_requests" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "preferredTimes" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interview_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_requests_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interview_requests_applicationId_idx" ON "interview_requests"("applicationId");
CREATE INDEX IF NOT EXISTS "interview_requests_jobId_idx" ON "interview_requests"("jobId");
CREATE INDEX IF NOT EXISTS "interview_requests_clientId_idx" ON "interview_requests"("clientId");
CREATE INDEX IF NOT EXISTS "interview_requests_organizationId_idx" ON "interview_requests"("organizationId");
CREATE INDEX IF NOT EXISTS "interview_requests_status_idx" ON "interview_requests"("status");
