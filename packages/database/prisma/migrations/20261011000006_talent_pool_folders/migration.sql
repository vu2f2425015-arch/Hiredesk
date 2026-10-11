-- Migration 20261011000006_talent_pool_folders: Add talent_pool_folders and talent_pool_folder_members tables
-- Phase 8A: Organization-Scoped Talent Pool & Folder Categorization

-- 1. Create talent_pool_folders table
CREATE TABLE IF NOT EXISTS "talent_pool_folders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_pool_folders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "talent_pool_folders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "talent_pool_folders_organizationId_name_key" ON "talent_pool_folders"("organizationId", "name");
CREATE INDEX IF NOT EXISTS "talent_pool_folders_organizationId_idx" ON "talent_pool_folders"("organizationId");

-- 2. Create talent_pool_folder_members table
CREATE TABLE IF NOT EXISTS "talent_pool_folder_members" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_pool_folder_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "talent_pool_folder_members_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "talent_pool_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "talent_pool_folder_members_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "talent_pool_folder_members_folderId_candidateId_key" ON "talent_pool_folder_members"("folderId", "candidateId");
CREATE INDEX IF NOT EXISTS "talent_pool_folder_members_folderId_idx" ON "talent_pool_folder_members"("folderId");
CREATE INDEX IF NOT EXISTS "talent_pool_folder_members_candidateId_idx" ON "talent_pool_folder_members"("candidateId");

-- 3. Add composite index on candidates(organizationId, candidateCode)
CREATE INDEX IF NOT EXISTS "candidates_organizationId_candidateCode_idx" ON "candidates"("organizationId", "candidateCode");
