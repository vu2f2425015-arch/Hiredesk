-- Migration 20261011000005_interviews_and_communications: Add interviews, interview_histories, and outbound_communications tables

-- 1. Create interviews table
CREATE TABLE IF NOT EXISTS "interviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "interviewerUserProfileId" TEXT NOT NULL,
    "scheduledByUserProfileId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'video',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "meetingProvider" TEXT,
    "meetingUrl" TEXT,
    "location" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "interviewerNotes" TEXT,
    "feedback" TEXT,
    "result" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interviews_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interviews_interviewerUserProfileId_fkey" FOREIGN KEY ("interviewerUserProfileId") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "interviews_scheduledByUserProfileId_fkey" FOREIGN KEY ("scheduledByUserProfileId") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interviews_organizationId_status_idx" ON "interviews"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "interviews_organizationId_startAt_idx" ON "interviews"("organizationId", "startAt");
CREATE INDEX IF NOT EXISTS "interviews_clientId_idx" ON "interviews"("clientId");
CREATE INDEX IF NOT EXISTS "interviews_jobId_idx" ON "interviews"("jobId");
CREATE INDEX IF NOT EXISTS "interviews_applicationId_idx" ON "interviews"("applicationId");
CREATE INDEX IF NOT EXISTS "interviews_candidateId_idx" ON "interviews"("candidateId");
CREATE INDEX IF NOT EXISTS "interviews_interviewerUserProfileId_startAt_idx" ON "interviews"("interviewerUserProfileId", "startAt");

-- 2. Link interviewId in interview_requests
ALTER TABLE "interview_requests" ADD COLUMN IF NOT EXISTS "interviewId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'interview_requests_interviewId_fkey'
    ) THEN
        ALTER TABLE "interview_requests"
        ADD CONSTRAINT "interview_requests_interviewId_fkey"
        FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "interview_requests_interviewId_idx" ON "interview_requests"("interviewId");

-- 3. Create interview_histories table
CREATE TABLE IF NOT EXISTS "interview_histories" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "actorId" TEXT,
    "previousStatus" TEXT NOT NULL,
    "nextStatus" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_histories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "interview_histories_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "interview_histories_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "interview_histories_interviewId_createdAt_idx" ON "interview_histories"("interviewId", "createdAt");

-- 4. Create outbound_communications table
CREATE TABLE IF NOT EXISTS "outbound_communications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "candidateId" TEXT,
    "applicationId" TEXT,
    "jobId" TEXT,
    "interviewId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_communications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbound_communications_idempotencyKey_key" UNIQUE ("idempotencyKey"),
    CONSTRAINT "outbound_communications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "outbound_communications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_communications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_communications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "outbound_communications_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "outbound_communications_organizationId_status_idx" ON "outbound_communications"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "outbound_communications_interviewId_idx" ON "outbound_communications"("interviewId");
CREATE INDEX IF NOT EXISTS "outbound_communications_recipientEmail_idx" ON "outbound_communications"("recipientEmail");
CREATE INDEX IF NOT EXISTS "outbound_communications_status_createdAt_idx" ON "outbound_communications"("status", "createdAt");
