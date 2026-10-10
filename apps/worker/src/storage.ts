import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { workerConfig } from './config.js';
import { logger } from './logger.js';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename: string;
  extension: string;
  mimeType: string;
}

export interface StorageAdapter {
  uploadFile(bucket: string, storagePath: string, buffer: Buffer, contentType: string): Promise<void>;
  deleteFile(bucket: string, storagePath: string): Promise<void>;
  createSignedUrl(bucket: string, storagePath: string, expiresInSeconds: number): Promise<string>;
}

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates file signature (magic bytes) to prevent extension/MIME spoofing.
 */
export function validateMagicBytes(buffer: Buffer, declaredExt: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  const ext = declaredExt.toLowerCase();

  if (ext === '.pdf') {
    // PDF magic bytes: "%PDF-" -> 0x25, 0x50, 0x44, 0x46
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  if (ext === '.docx') {
    // DOCX is a zip archive: "PK\x03\x04" -> 0x50, 0x4B, 0x03, 0x04
    return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  }

  if (ext === '.doc') {
    // Legacy DOC (OLE compound file): 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1
    if (buffer.length < 8) return false;
    return (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1
    );
  }

  return false;
}

/**
 * Sanitizes original filename to prevent path traversal, control characters, and collisions.
 */
export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName);
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_]/g, '_').trim();
  return cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned || 'resume.pdf';
}

/**
 * Full file validation covering size, extension, MIME, and magic bytes.
 */
export function validateAttachment(file: {
  filename: string;
  contentType: string;
  size: number;
  buffer: Buffer;
}): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
      sanitizedFilename: sanitizeFilename(file.filename),
      extension: '',
      mimeType: file.contentType,
    };
  }

  const ext = path.extname(file.filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `Unsupported file extension (${ext || 'unknown'}). Only PDF, DOCX, and DOC are accepted.`,
      sanitizedFilename: sanitizeFilename(file.filename),
      extension: ext,
      mimeType: file.contentType,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.contentType.toLowerCase())) {
    return {
      isValid: false,
      error: `Unsupported MIME type (${file.contentType}). Accepted types: PDF and Word documents.`,
      sanitizedFilename: sanitizeFilename(file.filename),
      extension: ext,
      mimeType: file.contentType,
    };
  }

  const matchesSignature = validateMagicBytes(file.buffer, ext);
  if (!matchesSignature) {
    return {
      isValid: false,
      error: 'File content does not match its declared format (file signature mismatch).',
      sanitizedFilename: sanitizeFilename(file.filename),
      extension: ext,
      mimeType: file.contentType,
    };
  }

  return {
    isValid: true,
    sanitizedFilename: sanitizeFilename(file.filename),
    extension: ext,
    mimeType: file.contentType,
  };
}

class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient | null = null;

  constructor() {
    if (workerConfig.SUPABASE_URL && workerConfig.SUPABASE_SERVICE_ROLE_KEY) {
      this.client = createClient(workerConfig.SUPABASE_URL, workerConfig.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  async uploadFile(bucket: string, storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase client is not configured for worker storage operations');
    }
    const { error } = await this.client.storage.from(bucket).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      logger.error({ err: error.message, bucket, storagePath }, 'Worker failed to upload file to Supabase Storage');
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async deleteFile(bucket: string, storagePath: string): Promise<void> {
    if (!this.client) return;
    try {
      const { error } = await this.client.storage.from(bucket).remove([storagePath]);
      if (error) {
        logger.warn({ err: error.message, bucket, storagePath }, 'Worker failed to remove file from Supabase Storage');
      }
    } catch (e: any) {
      logger.warn({ err: e.message, bucket, storagePath }, 'Worker exception during file removal from Supabase Storage');
    }
  }

  async createSignedUrl(bucket: string, storagePath: string, expiresInSeconds: number): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase client is not configured for storage operations');
    }
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
    }
    return data.signedUrl;
  }
}

let activeWorkerStorageAdapter: StorageAdapter = new SupabaseStorageAdapter();

export function setWorkerStorageAdapter(adapter: StorageAdapter): void {
  activeWorkerStorageAdapter = adapter;
}

export function resetWorkerStorageAdapter(): void {
  activeWorkerStorageAdapter = new SupabaseStorageAdapter();
}

export class WorkerStorageService {
  static readonly BUCKET = workerConfig.STORAGE_BUCKET_RESUMES || 'resumes';

  static async uploadResume(params: {
    organizationId: string;
    candidateId: string;
    buffer: Buffer;
    extension: string;
    contentType: string;
  }): Promise<{
    storagePath: string;
    safeFilename: string;
    checksum: string;
    fileSize: number;
  }> {
    const fileId = randomUUID();
    const safeFilename = `${fileId}${params.extension}`;
    const storagePath = `${params.organizationId}/${params.candidateId}/${safeFilename}`;
    const checksum = createHash('sha256').update(params.buffer).digest('hex');

    await activeWorkerStorageAdapter.uploadFile(
      WorkerStorageService.BUCKET,
      storagePath,
      params.buffer,
      params.contentType
    );

    return {
      storagePath,
      safeFilename,
      checksum,
      fileSize: params.buffer.length,
    };
  }

  static async deleteResume(storagePath: string): Promise<void> {
    await activeWorkerStorageAdapter.deleteFile(WorkerStorageService.BUCKET, storagePath);
  }
}
