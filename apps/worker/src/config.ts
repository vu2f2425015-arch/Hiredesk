import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const WorkerConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  IMAP_HOST: z.string().default('localhost'),
  IMAP_PORT: z.coerce.number().default(993),
  IMAP_SECURE: z.coerce.boolean().default(true),
  IMAP_USER: z.string().default('test@agency.local'),
  IMAP_PASS: z.string().default('secret'),
  IMAP_MAILBOX_ID: z.string().default('primary-inbox'),
  IMAP_POLL_INTERVAL_MS: z.coerce.number().default(30000),
  STORAGE_BUCKET_RESUMES: z.string().default('resumes'),
});

const parsed = WorkerConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid worker configuration:', parsed.error.format());
  throw new Error('Invalid worker configuration');
}

export const workerConfig = parsed.data;
