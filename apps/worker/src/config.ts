import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const WorkerConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  IMAP_HOST: z.string().default('localhost'),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z.coerce.boolean().default(true),
  IMAP_USER: z.string().optional(),
  IMAP_USERNAME: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  IMAP_MAILBOX: z.string().default('INBOX'),
  IMAP_MAILBOX_ID: z.string().optional(),
  INBOUND_MAILBOX_ID: z.string().default('primary-hostinger-inbox'),
  IMAP_POLL_INTERVAL_MS: z.coerce.number().default(30000),
  IMAP_MAX_RETRIES: z.coerce.number().default(8),
  STORAGE_BUCKET_RESUMES: z.string().default('resumes'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = WorkerConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid worker configuration:', parsed.error.format());
  throw new Error('Invalid worker configuration');
}

const raw = parsed.data;

export const workerConfig = {
  ...raw,
  IMAP_USERNAME: raw.IMAP_USERNAME || raw.IMAP_USER || '',
  IMAP_PASSWORD: raw.IMAP_PASSWORD || raw.IMAP_PASS || '',
  INBOUND_MAILBOX_ID: raw.INBOUND_MAILBOX_ID || raw.IMAP_MAILBOX_ID || 'primary-hostinger-inbox',
};
