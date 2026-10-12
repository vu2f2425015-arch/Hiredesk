import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.STORAGE_BUCKET_RESUMES || 'resumes';

if (!supabaseUrl || !supabaseKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Recursively list all files in a Supabase Storage bucket folder.
 */
async function listAllFiles(prefix = '') {
  const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    throw new Error(`Failed to list storage path "${prefix}": ${error.message}`);
  }

  let files = [];
  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null || !item.metadata) {
      // It's a folder / directory
      const subFiles = await listAllFiles(fullPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push({
        path: fullPath,
        name: item.name,
        size: item.metadata.size,
        mimetype: item.metadata.mimetype,
        updatedAt: item.updated_at,
      });
    }
  }
  return files;
}

export async function backupStorage(targetDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = targetDir || path.join(process.cwd(), 'backups', `storage_${timestamp}`);
  fs.mkdirSync(backupFolder, { recursive: true });

  console.log(`[BACKUP] Querying Supabase Storage bucket "${bucketName}"...`);
  const files = await listAllFiles();
  console.log(`[BACKUP] Discovered ${files.length} objects in bucket.`);

  const manifest = {
    bucket: bucketName,
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    objects: [],
  };

  for (const file of files) {
    const { data, error } = await supabase.storage.from(bucketName).download(file.path);
    if (error) {
      console.error(`[WARN] Failed to download "${file.path}": ${error.message}`);
      continue;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const destPath = path.join(backupFolder, file.path);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buffer);

    manifest.objects.push({
      storagePath: file.path,
      sizeBytes: buffer.length,
      sha256: checksum,
      savedTo: path.relative(backupFolder, destPath),
    });
  }

  const manifestPath = path.join(backupFolder, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[SUCCESS] Storage backup complete: ${manifest.objects.length}/${files.length} objects saved.`);
  console.log(`          Backup destination: ${backupFolder}`);
  return { backupFolder, manifest };
}

// If executed directly from CLI
if (process.argv[1] && process.argv[1].endsWith('backup-storage.mjs')) {
  backupStorage()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[FATAL] Storage backup failed:', err);
      process.exit(1);
    });
}
