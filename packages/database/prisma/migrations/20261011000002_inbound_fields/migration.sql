-- Migration 20261011000002_inbound_fields: Add matchedClientId, lastAttemptAt, rawPayload and indexes to inbound_applications

ALTER TABLE "inbound_applications" ADD COLUMN IF NOT EXISTS "matchedClientId" TEXT;
ALTER TABLE "inbound_applications" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
ALTER TABLE "inbound_applications" ADD COLUMN IF NOT EXISTS "rawPayload" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS "inbound_applications_matchedOrgId_idx" ON "inbound_applications"("matchedOrgId");
CREATE INDEX IF NOT EXISTS "inbound_applications_messageId_idx" ON "inbound_applications"("messageId");
