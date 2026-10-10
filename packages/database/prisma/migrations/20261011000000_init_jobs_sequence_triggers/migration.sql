-- Initial Schema Migration for HiredeskHR with Atomic Sequence and Immutability Triggers

-- 1. Create Organizations table
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Clients table
CREATE TABLE IF NOT EXISTS "clients" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "clients_organizationId_name_idx" ON "clients"("organizationId", "name");

-- 3. Create User Profiles table
CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "authUserId" TEXT NOT NULL UNIQUE,
    "organizationId" TEXT REFERENCES "organizations"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL,
    "clientId" TEXT REFERENCES "clients"("id") ON DELETE SET NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "user_profiles_authUserId_idx" ON "user_profiles"("authUserId");
CREATE INDEX IF NOT EXISTS "user_profiles_organizationId_idx" ON "user_profiles"("organizationId");
CREATE INDEX IF NOT EXISTS "user_profiles_clientId_idx" ON "user_profiles"("clientId");
CREATE INDEX IF NOT EXISTS "user_profiles_email_idx" ON "user_profiles"("email");

-- 4. Global Atomic Job Code Sequence (starts at 1001)
CREATE SEQUENCE IF NOT EXISTS job_code_seq START WITH 1001 INCREMENT BY 1;

-- 5. Create Jobs table
CREATE TABLE IF NOT EXISTS "jobs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE RESTRICT,
    "jobCode" TEXT NOT NULL UNIQUE,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "employmentType" TEXT NOT NULL,
    "workplaceModel" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "salaryMin" DECIMAL(12,2),
    "salaryMax" DECIMAL(12,2),
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "openings" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "education" TEXT,
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "applicationFormConfig" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "jobs_organizationId_status_idx" ON "jobs"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "jobs_clientId_idx" ON "jobs"("clientId");
CREATE INDEX IF NOT EXISTS "jobs_jobCode_idx" ON "jobs"("jobCode");

-- 6. Trigger Function to Enforce Job Code Immutability
CREATE OR REPLACE FUNCTION enforce_job_code_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."jobCode" IS NOT NULL AND NEW."jobCode" <> OLD."jobCode" THEN
        RAISE EXCEPTION 'jobCode is immutable and cannot be updated once set';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_job_code ON "jobs";
CREATE TRIGGER trg_protect_job_code
BEFORE UPDATE OF "jobCode" ON "jobs"
FOR EACH ROW
EXECUTE FUNCTION enforce_job_code_immutability();

-- 7. Candidates table
CREATE TABLE IF NOT EXISTS "candidates" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "candidateCode" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "country" TEXT,
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "education" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "experience" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "sourceMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "candidates_org_email_key" UNIQUE ("organizationId", "normalizedEmail")
);
CREATE INDEX IF NOT EXISTS "candidates_organizationId_idx" ON "candidates"("organizationId");

-- 8. Applications table
CREATE TABLE IF NOT EXISTS "applications" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "candidateId" TEXT NOT NULL REFERENCES "candidates"("id") ON DELETE CASCADE,
    "jobId" TEXT NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "clientId" TEXT NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "stage" TEXT NOT NULL DEFAULT 'Applied',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "answers" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "recruiterNotes" TEXT,
    "clientFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applications_job_candidate_key" UNIQUE ("jobId", "candidateId")
);
CREATE INDEX IF NOT EXISTS "applications_organizationId_jobId_stage_idx" ON "applications"("organizationId", "jobId", "stage");
CREATE INDEX IF NOT EXISTS "applications_clientId_stage_idx" ON "applications"("clientId", "stage");

-- 9. Resumes table
CREATE TABLE IF NOT EXISTS "resumes" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "candidateId" TEXT NOT NULL REFERENCES "candidates"("id") ON DELETE CASCADE,
    "applicationId" TEXT REFERENCES "applications"("id") ON DELETE SET NULL,
    "bucket" TEXT NOT NULL DEFAULT 'resumes',
    "storagePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "safeFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "extractedText" TEXT,
    "parsingStatus" TEXT NOT NULL DEFAULT 'pending',
    "parsingError" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "resumes_candidateId_idx" ON "resumes"("candidateId");
CREATE INDEX IF NOT EXISTS "resumes_applicationId_idx" ON "resumes"("applicationId");
CREATE INDEX IF NOT EXISTS "resumes_checksum_idx" ON "resumes"("checksum");

-- 10. Inbound Applications table
CREATE TABLE IF NOT EXISTS "inbound_applications" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "mailboxId" TEXT NOT NULL,
    "uidValidity" BIGINT NOT NULL,
    "uid" BIGINT NOT NULL,
    "messageId" TEXT,
    "subject" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "extractedJobCode" TEXT,
    "matchedJobId" TEXT,
    "matchedOrgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "linkedCandidateId" TEXT,
    "linkedApplicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inbound_mailbox_uid_key" UNIQUE ("mailboxId", "uidValidity", "uid")
);
CREATE INDEX IF NOT EXISTS "inbound_status_idx" ON "inbound_applications"("status");
CREATE INDEX IF NOT EXISTS "inbound_extractedJobCode_idx" ON "inbound_applications"("extractedJobCode");

-- 11. Stage Histories table
CREATE TABLE IF NOT EXISTS "stage_histories" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "applicationId" TEXT NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
    "previousStage" TEXT NOT NULL,
    "nextStage" TEXT NOT NULL,
    "actorId" TEXT REFERENCES "user_profiles"("id") ON DELETE SET NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "stage_histories_applicationId_timestamp_idx" ON "stage_histories"("applicationId", "timestamp");

-- 12. Activity Logs table
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
    "actorId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "activity_logs_organizationId_timestamp_idx" ON "activity_logs"("organizationId", "timestamp");
