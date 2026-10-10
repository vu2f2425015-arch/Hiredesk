import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseApplicationEmail,
} from '../src/emailParser.js';
import {
  validateAttachment,
  setWorkerStorageAdapter,
  StorageAdapter,
} from '../src/storage.js';
import {
  claimOrRegisterInboundRecord,
  processInboundEmail,
} from '../src/inboundProcessor.js';
import { setCandidateCodeAllocator } from '@hiredesk/database';
import { InboundStatus, JobStatus, INBOUND_FAILURE_REASONS } from '@hiredesk/shared';

// Minimal valid PDF header "%PDF-1.4\n..."
const VALID_PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
// Corrupted buffer declared as PDF
const INVALID_PDF_BUFFER = Buffer.from('NOT A REAL PDF FILE');

class MockStorageAdapter implements StorageAdapter {
  public uploads: Array<{ bucket: string; storagePath: string; buffer: Buffer; contentType: string }> = [];
  public deletions: Array<{ bucket: string; storagePath: string }> = [];

  async uploadFile(bucket: string, storagePath: string, buffer: Buffer, contentType: string): Promise<void> {
    this.uploads.push({ bucket, storagePath, buffer, contentType });
  }

  async deleteFile(bucket: string, storagePath: string): Promise<void> {
    this.deletions.push({ bucket, storagePath });
  }

  async createSignedUrl(bucket: string, storagePath: string, _expiresInSeconds: number): Promise<string> {
    return `https://mock-storage.local/${bucket}/${storagePath}?token=mock`;
  }
}

describe('PyjamaHR Inbound Email Parser & Attachment Validator', () => {
  it('parses applicant details from structured PyjamaHR email body', async () => {
    const rawRfc822 = [
      'From: PyjamaHR Notifications <notifications@pyjamahr.com>',
      'To: agency-inbound@hiredesk.io',
      'Subject: Application for Senior Backend Engineer (JOB-1001)',
      'Date: Sun, 11 Oct 2026 10:00:00 +0000',
      'Message-ID: <msg-pyjama-001@pyjamahr.com>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'A new candidate has applied for JOB-1001 via PyjamaHR:',
      'Name: Alice Smith',
      'Email: alice.smith@example.com',
      'Phone: +1 555-0144',
      'Location: New York, NY',
    ].join('\r\n');

    const parsed = await parseApplicationEmail(rawRfc822);
    expect(parsed.subject).toBe('Application for Senior Backend Engineer (JOB-1001)');
    expect(parsed.jobCodeResult.jobCode).toBe('JOB-1001');
    expect(parsed.candidateName).toBe('Alice Smith');
    expect(parsed.candidateEmail).toBe('alice.smith@example.com');
    expect(parsed.candidatePhone).toBe('+1 555-0144');
    expect(parsed.candidateLocation).toBe('New York, NY');
  });

  it('validates genuine PDF magic bytes and rejects spoofed headers', () => {
    const validResult = validateAttachment({
      filename: 'alice_resume.pdf',
      contentType: 'application/pdf',
      size: VALID_PDF_BUFFER.length,
      buffer: VALID_PDF_BUFFER,
    });
    expect(validResult.isValid).toBe(true);
    expect(validResult.extension).toBe('.pdf');

    const invalidResult = validateAttachment({
      filename: 'spoofed.pdf',
      contentType: 'application/pdf',
      size: INVALID_PDF_BUFFER.length,
      buffer: INVALID_PDF_BUFFER,
    });
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.error).toContain('file signature mismatch');
  });

  it('rejects files exceeding the 10 MB limit', () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    oversizedBuffer.write('%PDF-');

    const res = validateAttachment({
      filename: 'huge_resume.pdf',
      contentType: 'application/pdf',
      size: oversizedBuffer.length,
      buffer: oversizedBuffer,
    });
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('10 MB limit');
  });
});

describe('Inbound Processing Engine & Deduplication Logic', () => {
  let mockStorage: MockStorageAdapter;

  beforeEach(() => {
    mockStorage = new MockStorageAdapter();
    setWorkerStorageAdapter(mockStorage);
    setCandidateCodeAllocator(async () => 'CAND-1005');
  });

  // Mock Database Client for Unit Testing
  function createMockPrisma(overrides: {
    existingInbound?: any;
    job?: any;
    existingCandidate?: any;
    existingApp?: any;
    failTransaction?: boolean;
  } = {}) {
    const inboundTable = new Map<string, any>();
    if (overrides.existingInbound) {
      inboundTable.set(overrides.existingInbound.id, { ...overrides.existingInbound });
    }

    return {
      $queryRaw: vi.fn(async () => [{ code: 'CAND-1005' }]),
      inboundApplication: {
        findUnique: vi.fn(async (args: any) => {
          if (args.where?.id) {
            return inboundTable.get(args.where.id) || null;
          }
          if (args.where?.mailboxId_uidValidity_uid) {
            const { mailboxId, uidValidity, uid } = args.where.mailboxId_uidValidity_uid;
            for (const r of inboundTable.values()) {
              if (r.mailboxId === mailboxId && r.uidValidity === uidValidity && r.uid === uid) {
                return r;
              }
            }
          }
          return null;
        }),
        updateMany: vi.fn(async (args: any) => {
          const rec = inboundTable.get(args.where.id);
          if (rec) {
            Object.assign(rec, args.data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
        create: vi.fn(async (args: any) => {
          const rec = { id: 'inbound-new-uuid', ...args.data };
          inboundTable.set(rec.id, rec);
          return rec;
        }),
        update: vi.fn(async (args: any) => {
          const rec = inboundTable.get(args.where.id);
          if (rec) {
            Object.assign(rec, args.data);
            return rec;
          }
          return { id: args.where.id, ...args.data };
        }),
      },
      job: {
        findUnique: vi.fn(async (_args: any) => overrides.job || null),
      },
      candidate: {
        findUnique: vi.fn(async (_args: any) => overrides.existingCandidate || null),
        create: vi.fn(async (args: any) => ({ id: 'cand-new-uuid', candidateCode: 'CAND-1005', ...args.data })),
        update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
      },
      application: {
        findUnique: vi.fn(async (_args: any) => overrides.existingApp || null),
        create: vi.fn(async (args: any) => ({ id: 'app-new-uuid', ...args.data })),
      },
      resume: {
        create: vi.fn(async (args: any) => ({ id: 'resume-new-uuid', ...args.data })),
      },
      stageHistory: {
        create: vi.fn(async (args: any) => ({ id: 'stage-new-uuid', ...args.data })),
      },
      activityLog: {
        create: vi.fn(async (args: any) => ({ id: 'log-new-uuid', ...args.data })),
      },
      $transaction: vi.fn(async (callback: any) => {
        if (overrides.failTransaction) {
          throw new Error('Simulated DB Transaction Failure');
        }
        return callback({
          application: {
            create: vi.fn(async (args: any) => ({ id: 'app-tx-uuid', ...args.data })),
          },
          resume: {
            create: vi.fn(async (args: any) => ({ id: 'resume-tx-uuid', ...args.data })),
          },
          stageHistory: {
            create: vi.fn(async (args: any) => ({ id: 'stage-tx-uuid', ...args.data })),
          },
          activityLog: {
            create: vi.fn(async (args: any) => ({ id: 'log-tx-uuid', ...args.data })),
          },
          inboundApplication: {
            update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })),
          },
        });
      }),
    } as any;
  }

  it('email with no Job Code creates an unmatched record with no_job_code', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-1',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(1),
        status: InboundStatus.PROCESSING,
      },
    });

    const rawEmail = 'From: test@sender.com\r\nSubject: General Inquiry\r\n\r\nJust saying hello';
    const result = await processInboundEmail('inbound-1', rawEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.UNMATCHED);
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.NO_JOB_CODE);
  });

  it('unknown Job Code creates an unmatched record with job_code_not_found', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-2',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(2),
        status: InboundStatus.PROCESSING,
      },
      job: null, // Job Code not found in database
    });

    const rawEmail = 'From: test@sender.com\r\nSubject: Applying for JOB-9999\r\n\r\nHello';
    const result = await processInboundEmail('inbound-2', rawEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.UNMATCHED);
    expect(result.jobCode).toBe('JOB-9999');
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.JOB_CODE_NOT_FOUND);
  });

  it('multiple distinct Job Codes creates an unmatched record with ambiguous_job_code', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-3',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(3),
        status: InboundStatus.PROCESSING,
      },
    });

    const rawEmail = 'From: test@sender.com\r\nSubject: Applying for JOB-1001 and JOB-1002\r\n\r\nBoth roles look great';
    const result = await processInboundEmail('inbound-3', rawEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.UNMATCHED);
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.AMBIGUOUS_JOB_CODE);
  });

  it('closed or draft job marks unmatched with job_not_accepting_applications', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-4',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(4),
        status: InboundStatus.PROCESSING,
      },
      job: {
        id: 'job-closed-uuid',
        jobCode: 'JOB-1003',
        status: JobStatus.CLOSED,
        organizationId: 'org-1',
        clientId: 'client-1',
      },
    });

    const rawEmail = 'From: test@sender.com\r\nSubject: Applying for JOB-1003\r\n\r\nResume attached';
    const result = await processInboundEmail('inbound-4', rawEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.UNMATCHED);
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.JOB_NOT_ACCEPTING_APPLICATIONS);
  });

  it('email with missing resume marks unmatched with resume_missing', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-5',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(5),
        status: InboundStatus.PROCESSING,
      },
      job: {
        id: 'job-active-uuid',
        jobCode: 'JOB-1001',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-1',
        clientId: 'client-1',
      },
    });

    const rawEmail = [
      'From: candidate@example.com',
      'Subject: Applying for JOB-1001',
      '',
      'Name: Bob Jones',
      'Email: bob.jones@example.com',
    ].join('\r\n');

    const result = await processInboundEmail('inbound-5', rawEmail, undefined, mockDb);
    expect(result.status).toBe(InboundStatus.UNMATCHED);
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.RESUME_MISSING);
  });

  it('successful application creates candidate, uploads resume, creates application and links records', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-success-1',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(9),
        status: InboundStatus.PROCESSING,
      },
      job: {
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        title: 'Backend Engineer',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-acme-uuid',
        clientId: 'client-globex-uuid',
      },
    });

    const multipartEmail = [
      'From: applicant@domain.com',
      'To: inbound@hiredesk.io',
      'Subject: Application for JOB-1001 - Charlie Brown',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="TEST_BOUNDARY"',
      '',
      '--TEST_BOUNDARY',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Name: Charlie Brown',
      'Email: charlie.brown@domain.com',
      'Phone: +1 555-4321',
      'Location: Austin, TX',
      '',
      '--TEST_BOUNDARY',
      'Content-Type: application/pdf; name="resume.pdf"',
      'Content-Disposition: attachment; filename="resume.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      VALID_PDF_BUFFER.toString('base64'),
      '--TEST_BOUNDARY--',
    ].join('\r\n');

    const result = await processInboundEmail('inbound-success-1', multipartEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.MATCHED);
    expect(result.jobCode).toBe('JOB-1001');
    expect(result.matchedJobId).toBe('job-101-uuid');
    expect(result.matchedOrgId).toBe('org-acme-uuid');
    expect(result.applicationId).toBe('app-tx-uuid');
    expect(mockStorage.uploads.length).toBe(1);
    expect(mockStorage.uploads[0].storagePath).toContain('org-acme-uuid');
  });

  it('compensating cleanup: deletes uploaded resume when DB transaction fails', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-fail-tx',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(10),
        status: InboundStatus.PROCESSING,
      },
      job: {
        id: 'job-101-uuid',
        jobCode: 'JOB-1001',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-acme-uuid',
        clientId: 'client-globex-uuid',
      },
      failTransaction: true,
    });

    const multipartEmail = [
      'From: applicant@domain.com',
      'To: inbound@hiredesk.io',
      'Subject: Application for JOB-1001',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="TEST_BOUNDARY"',
      '',
      '--TEST_BOUNDARY',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Name: Charlie Brown',
      'Email: charlie.brown@domain.com',
      '',
      '--TEST_BOUNDARY',
      'Content-Type: application/pdf; name="resume.pdf"',
      'Content-Disposition: attachment; filename="resume.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      VALID_PDF_BUFFER.toString('base64'),
      '--TEST_BOUNDARY--',
    ].join('\r\n');

    const result = await processInboundEmail('inbound-fail-tx', multipartEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.FAILED);
    expect(result.failureReason).toBe(INBOUND_FAILURE_REASONS.DATABASE_FAILED);
    // Verifies compensating deletion was called!
    expect(mockStorage.deletions.length).toBe(1);
  });

  it('duplicate submission for same candidate & job marks duplicate without re-uploading resume', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-dup',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(6),
        status: InboundStatus.PROCESSING,
      },
      job: {
        id: 'job-1-uuid',
        jobCode: 'JOB-1001',
        status: JobStatus.PUBLISHED,
        organizationId: 'org-1',
        clientId: 'client-1',
      },
      existingCandidate: {
        id: 'cand-existing-uuid',
        normalizedEmail: 'bob.jones@example.com',
        organizationId: 'org-1',
      },
      existingApp: {
        id: 'app-existing-uuid',
        jobId: 'job-1-uuid',
        candidateId: 'cand-existing-uuid',
      },
    });

    const rawEmail = [
      'From: candidate@example.com',
      'Subject: Applying for JOB-1001',
      '',
      'Name: Bob Jones',
      'Email: bob.jones@example.com',
    ].join('\r\n');

    const result = await processInboundEmail('inbound-dup', rawEmail, undefined, mockDb);

    expect(result.status).toBe(InboundStatus.DUPLICATE);
    expect(result.isDuplicate).toBe(true);
    expect(result.applicationId).toBe('app-existing-uuid');
    expect(mockStorage.uploads.length).toBe(0); // Zero resume uploads
  });

  it('reprocessing already matched message returns immediately without duplicate creation', async () => {
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-already-matched',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(7),
        status: InboundStatus.MATCHED,
        extractedJobCode: 'JOB-1001',
        matchedJobId: 'job-1',
        linkedApplicationId: 'app-1',
      },
    });

    const result = await processInboundEmail('inbound-already-matched', '', undefined, mockDb);
    expect(result.status).toBe(InboundStatus.MATCHED);
    expect(result.applicationId).toBe('app-1');
  });

  it('expired lease (> 5 min) can be safely reclaimed for restart recovery', async () => {
    const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
    const mockDb = createMockPrisma({
      existingInbound: {
        id: 'inbound-stuck',
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(8),
        status: InboundStatus.PROCESSING,
        lastAttemptAt: sixMinutesAgo,
      },
    });

    const claim = await claimOrRegisterInboundRecord(
      {
        mailboxId: 'box-1',
        uidValidity: BigInt(100),
        uid: BigInt(8),
        subject: 'Resume',
        senderEmail: 'test@example.com',
        recipientEmail: 'inbound@hiredesk.io',
        receivedAt: new Date(),
      },
      mockDb
    );

    expect(claim.claimed).toBe(true);
  });
});
