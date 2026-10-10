import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

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
  // Remove any character that is not alphanumeric, dot, dash, or underscore
  const cleaned = base.replace(/[^a-zA-Z0-9.\-_]/g, '_').trim();
  // Limit length to 100 chars
  return cleaned.length > 100 ? cleaned.slice(0, 100) : cleaned || 'resume.pdf';
}

/**
 * Full file validation covering size, extension, MIME, and magic bytes.
 */
export function validateUploadedFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
      sanitizedFilename: sanitizeFilename(file.originalname),
      extension: '',
      mimeType: file.mimetype,
    };
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `Unsupported file type (${ext || 'unknown'}). Only PDF, DOCX, and DOC are accepted.`,
      sanitizedFilename: sanitizeFilename(file.originalname),
      extension: ext,
      mimeType: file.mimetype,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    return {
      isValid: false,
      error: `Unsupported MIME type (${file.mimetype}). Accepted types: PDF and Word documents.`,
      sanitizedFilename: sanitizeFilename(file.originalname),
      extension: ext,
      mimeType: file.mimetype,
    };
  }

  const matchesSignature = validateMagicBytes(file.buffer, ext);
  if (!matchesSignature) {
    return {
      isValid: false,
      error: 'File content does not match its declared format (file signature mismatch).',
      sanitizedFilename: sanitizeFilename(file.originalname),
      extension: ext,
      mimeType: file.mimetype,
    };
  }

  return {
    isValid: true,
    sanitizedFilename: sanitizeFilename(file.originalname),
    extension: ext,
    mimeType: file.mimetype,
  };
}

class SupabaseStorageAdapter implements StorageAdapter {
  private client: SupabaseClient | null = null;

  constructor() {
    if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
      this.client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }

  async uploadFile(bucket: string, storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
    if (!this.client) {
      throw new Error('Supabase client is not configured for storage operations');
    }
    const { error } = await this.client.storage.from(bucket).upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      logger.error({ err: error.message, bucket, storagePath }, 'Failed to upload file to Supabase Storage');
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async deleteFile(bucket: string, storagePath: string): Promise<void> {
    if (!this.client) return;
    try {
      const { error } = await this.client.storage.from(bucket).remove([storagePath]);
      if (error) {
        logger.warn({ err: error.message, bucket, storagePath }, 'Failed to remove file from Supabase Storage');
      }
    } catch (e: any) {
      logger.warn({ err: e.message, bucket, storagePath }, 'Exception during file removal from Supabase Storage');
    }
  }

  async createSignedUrl(bucket: string, storagePath: string, expiresInSeconds: number): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase client is not configured for storage operations');
    }
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      logger.error({ err: error?.message, bucket, storagePath }, 'Failed to generate signed download URL');
      throw new Error(`Failed to generate signed URL: ${error?.message || 'Unknown error'}`);
    }
    return data.signedUrl;
  }
}

let activeStorageAdapter: StorageAdapter = new SupabaseStorageAdapter();

export function setStorageAdapter(adapter: StorageAdapter): void {
  activeStorageAdapter = adapter;
}

export function resetStorageAdapter(): void {
  activeStorageAdapter = new SupabaseStorageAdapter();
}

export class StorageService {
  static readonly BUCKET = config.STORAGE_BUCKET_RESUMES || 'resumes';

  /**
   * Uploads resume buffer to private storage under resumes/{orgId}/{candidateId}/{uuid}.{ext}
   */
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

    await activeStorageAdapter.uploadFile(StorageService.BUCKET, storagePath, params.buffer, params.contentType);

    return {
      storagePath,
      safeFilename,
      checksum,
      fileSize: params.buffer.length,
    };
  }

  /**
   * Cleans up orphaned or unreferenced file from private storage.
   */
  static async deleteResume(storagePath: string): Promise<void> {
    await activeStorageAdapter.deleteFile(StorageService.BUCKET, storagePath);
  }

  /**
   * Generates a short-lived signed URL for authorized download.
   */
  static async getSignedResumeUrl(storagePath: string, expiresInSeconds = 60): Promise<string> {
    return activeStorageAdapter.createSignedUrl(StorageService.BUCKET, storagePath, expiresInSeconds);
  }
}
