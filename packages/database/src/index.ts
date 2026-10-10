import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = global.prismaGlobal || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export type JobCodeAllocator = (client?: PrismaClient) => Promise<string>;

let customJobCodeAllocator: JobCodeAllocator | null = null;

export function setJobCodeAllocator(allocator: JobCodeAllocator | null): void {
  customJobCodeAllocator = allocator;
}

/**
 * Concurrency-safe atomic Job Code allocator querying PostgreSQL sequence job_code_seq.
 * Returns formatted code: JOB-1001, JOB-1002, etc.
 */
export async function allocateNextJobCode(client: PrismaClient = prisma): Promise<string> {
  if (customJobCodeAllocator) {
    return customJobCodeAllocator(client);
  }
  const result = await client.$queryRaw<{ code: string }[]>`
    SELECT 'JOB-' || nextval('job_code_seq')::TEXT as code
  `;
  if (!result || result.length === 0 || !result[0].code) {
    throw new Error('Failed to allocate job code from sequence');
  }
  return result[0].code;
}

export * from '@prisma/client';
