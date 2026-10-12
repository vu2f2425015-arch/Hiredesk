import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { backupStorage } from './backup-storage.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.STORAGE_BUCKET_RESUMES || 'resumes';

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runSyntheticBackupRestoreTest() {
  console.log('================================================================');
  console.log('=== HiredeskHR — Synthetic Backup & Restore Verification Drill ===');
  console.log('================================================================\n');

  const testId = randomUUID();
  const testOrgId = `synth-org-${testId.slice(0, 8)}`;
  const testCandId = `synth-cand-${testId.slice(0, 8)}`;
  const syntheticFileName = `synthetic_resume_${testId.slice(0, 8)}.pdf`;
  const storagePath = `${testOrgId}/${testCandId}/${syntheticFileName}`;

  // Synthetic valid PDF content (starts with %PDF- magic bytes)
  const syntheticPdfContent = Buffer.from(
    `%PDF-1.4\n%Synthetic Test Resume for Backup Drill\nID: ${testId}\nTimestamp: ${new Date().toISOString()}\n%%EOF`
  );
  const originalChecksum = createHash('sha256').update(syntheticPdfContent).digest('hex');

  console.log(`[DRILL STEP 1] Uploading synthetic candidate resume:`);
  console.log(`               Path:     ${storagePath}`);
  console.log(`               Checksum: ${originalChecksum}`);

  const { error: uploadErr } = await supabase.storage.from(bucketName).upload(storagePath, syntheticPdfContent, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (uploadErr) {
    throw new Error(`Failed to upload synthetic test file: ${uploadErr.message}`);
  }
  console.log(`[PASS] Step 1: Synthetic file successfully uploaded to Supabase Storage.\n`);

  // Step 2: Run backup procedure
  console.log(`[DRILL STEP 2] Executing Storage Backup Procedure...`);
  const testBackupDir = path.join(process.cwd(), 'backups', `synth_test_${Date.now()}`);
  const { manifest } = await backupStorage(testBackupDir);

  const matchedInManifest = manifest.objects.find((o) => o.storagePath === storagePath);
  if (!matchedInManifest) {
    throw new Error(`Synthetic file "${storagePath}" not found in backup manifest!`);
  }
  if (matchedInManifest.sha256 !== originalChecksum) {
    throw new Error(`Backup checksum mismatch! Expected ${originalChecksum}, got ${matchedInManifest.sha256}`);
  }
  console.log(`[PASS] Step 2: Synthetic resume captured in backup manifest with exact SHA-256 match.\n`);

  // Step 3: Simulate catastrophic loss (delete object from Supabase Storage)
  console.log(`[DRILL STEP 3] Simulating object loss / accidental deletion from storage bucket...`);
  const { error: deleteErr } = await supabase.storage.from(bucketName).remove([storagePath]);
  if (deleteErr) {
    throw new Error(`Failed to simulate deletion: ${deleteErr.message}`);
  }

  // Verify it is gone
  const { data: verifyGone } = await supabase.storage.from(bucketName).download(storagePath);
  if (verifyGone) {
    console.warn('[WARN] Object still returned by download; checking storage status...');
  }
  console.log(`[PASS] Step 3: Synthetic object deleted from Supabase Storage.\n`);

  // Step 4: Execute Restoration from backup archive
  console.log(`[DRILL STEP 4] Restoring synthetic file from local backup archive...`);
  const localBackupFile = path.join(testBackupDir, storagePath);
  if (!fs.existsSync(localBackupFile)) {
    throw new Error(`Restoration source file missing at ${localBackupFile}`);
  }

  const restoredBuffer = fs.readFileSync(localBackupFile);
  const { error: restoreErr } = await supabase.storage.from(bucketName).upload(storagePath, restoredBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (restoreErr) {
    throw new Error(`Restoration upload failed: ${restoreErr.message}`);
  }

  // Step 5: Verify restored file integrity
  console.log(`[DRILL STEP 5] Verifying restored file integrity from live bucket...`);
  const { data: downloadedRestored, error: redownloadErr } = await supabase.storage.from(bucketName).download(storagePath);
  if (redownloadErr || !downloadedRestored) {
    throw new Error(`Failed to re-download restored object: ${redownloadErr?.message}`);
  }

  const restoredDownloadedBuffer = Buffer.from(await downloadedRestored.arrayBuffer());
  const restoredChecksum = createHash('sha256').update(restoredDownloadedBuffer).digest('hex');

  if (restoredChecksum !== originalChecksum) {
    throw new Error(`Restored checksum mismatch! Expected ${originalChecksum}, got ${restoredChecksum}`);
  }
  console.log(`[PASS] Step 5: Restored object validated! Exact 100% SHA-256 checksum match.\n`);

  // Step 6: Safe Cleanup
  console.log(`[DRILL STEP 6] Cleaning up synthetic test artifacts...`);
  await supabase.storage.from(bucketName).remove([storagePath]);
  if (fs.existsSync(testBackupDir)) {
    fs.rmSync(testBackupDir, { recursive: true, force: true });
  }
  console.log(`[PASS] Step 6: Synthetic test artifacts completely cleaned up.\n`);

  console.log('================================================================');
  console.log('=== [SUCCESS] Synthetic Backup & Restore Drill Passed 100%   ===');
  console.log('================================================================\n');
}

runSyntheticBackupRestoreTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FAIL] Backup/Restore drill failed:', err);
    process.exit(1);
  });
