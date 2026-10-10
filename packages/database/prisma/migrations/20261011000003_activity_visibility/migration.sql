-- Migration 20261011000003_activity_visibility: Add visibility column and index to activity_logs

ALTER TABLE "activity_logs" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'internal';
CREATE INDEX IF NOT EXISTS "activity_logs_organizationId_visibility_idx" ON "activity_logs"("organizationId", "visibility");
