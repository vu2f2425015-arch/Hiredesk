import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import {
  claimOrRegisterInboundRecord,
  processInboundEmail,
} from './apps/worker/dist/inboundProcessor.js';
import { InboundStatus } from './packages/shared/dist/index.js';

async function runEndToEndVerification() {
  console.log('=== HiredeskHR Phase 4 End-to-End Inbound Email Verification ===\n');

  // 1. Check live job JOB-1003 in Supabase DB
  const job = await prisma.job.findUnique({
    where: { jobCode: 'JOB-1003' },
    include: { organization: true, client: true },
  });

  if (!job) {
    throw new Error('JOB-1003 not found in live database. Please run Phase 2/3 bootstrap first.');
  }

  console.log(`[PASS] Found target job: ${job.jobCode} - "${job.title}"`);
  console.log(`       Organization: ${job.organization.name} (${job.organization.id})`);
  console.log(`       Client: ${job.client.name} (${job.client.id})`);
  console.log(`       Job Status: ${job.status}\n`);

  // 2. Read sanitized fixture email
  const fixturePath = path.resolve('apps/worker/fixtures/sample_application_email.eml');
  const rawEmail = fs.readFileSync(fixturePath);

  const testUid = BigInt(Math.floor(Date.now() / 1000));
  const testMailboxId = 'primary-hostinger-inbox';
  const testUidValidity = BigInt(20261011);

  console.log(`[TEST 1] Ingesting test application email for Alex Rivera (UID: ${testUid})...`);

  // 3. Register & Claim Inbound Record
  const { record, claimed } = await claimOrRegisterInboundRecord({
    mailboxId: testMailboxId,
    uidValidity: testUidValidity,
    uid: testUid,
    messageId: `<pyjamahr-sample-fixture-${testUid}@pyjamahr.com>`,
    subject: 'Application received for Senior Backend Engineer (JOB-1003)',
    senderEmail: 'notifications@pyjamahr.com',
    senderName: 'PyjamaHR Notifications',
    recipientEmail: 'agency-inbound@hiredesk.io',
    receivedAt: new Date(),
  });

  if (!claimed) {
    throw new Error('Failed to claim inbound message lease');
  }
  console.log(`[PASS] Inbound record registered: ID ${record.id}, status: ${record.status}`);

  // 4. Process Email via Inbound Processing Engine
  const result = await processInboundEmail(record.id, rawEmail);

  console.log(`[PASS] Processing result: status = ${result.status}`);
  console.log(`       Job Code matched: ${result.jobCode}`);
  console.log(`       Matched Job ID: ${result.matchedJobId}`);
  console.log(`       Derived Org ID: ${result.matchedOrgId}`);
  console.log(`       Candidate ID: ${result.candidateId}`);
  console.log(`       Application ID: ${result.applicationId}`);

  if (result.status !== InboundStatus.MATCHED) {
    throw new Error(`Expected MATCHED status, got ${result.status} (Reason: ${result.failureReason})`);
  }

  // 5. Verify database integrity
  const candidate = await prisma.candidate.findUnique({
    where: { id: result.candidateId },
  });
  console.log(`[PASS] Candidate verified: ${candidate.candidateCode} - "${candidate.name}" (${candidate.normalizedEmail})`);

  const application = await prisma.application.findUnique({
    where: { id: result.applicationId },
    include: { resumes: true },
  });
  console.log(`[PASS] Application verified: Stage "${application.stage}", Source "${application.source}"`);
  console.log(`       Attached Resumes: ${application.resumes.length} (Path: ${application.resumes[0]?.storagePath})`);

  // 6. Test Deduplication Policy: re-process the exact same candidate submission under a new email message
  console.log('\n[TEST 2] Testing duplicate submission policy (same candidate applying again)...');
  const dupUid = testUid + 1n;
  const { record: dupRecord } = await claimOrRegisterInboundRecord({
    mailboxId: testMailboxId,
    uidValidity: testUidValidity,
    uid: dupUid,
    messageId: `<pyjamahr-dup-fixture-${dupUid}@pyjamahr.com>`,
    subject: 'Application received for Senior Backend Engineer (JOB-1003)',
    senderEmail: 'notifications@pyjamahr.com',
    recipientEmail: 'agency-inbound@hiredesk.io',
    receivedAt: new Date(),
  });

  const dupResult = await processInboundEmail(dupRecord.id, rawEmail);
  console.log(`[PASS] Duplicate processing result: status = ${dupResult.status}`);
  console.log(`       isDuplicate = ${dupResult.isDuplicate}`);
  console.log(`       Linked Existing Application = ${dupResult.applicationId}`);

  if (dupResult.status !== InboundStatus.DUPLICATE || !dupResult.isDuplicate) {
    throw new Error(`Expected DUPLICATE status for repeat submission, got ${dupResult.status}`);
  }

  // 7. Test Unmatched Policy: Email with no Job Code
  console.log('\n[TEST 3] Testing unmatched queue policy (email with no Job Code)...');
  const noCodeUid = testUid + 2n;
  const { record: noCodeRecord } = await claimOrRegisterInboundRecord({
    mailboxId: testMailboxId,
    uidValidity: testUidValidity,
    uid: noCodeUid,
    messageId: `<pyjamahr-nocode-fixture-${noCodeUid}@pyjamahr.com>`,
    subject: 'Candidate Inquiry Without Job Code',
    senderEmail: 'mystery@applicant.com',
    recipientEmail: 'agency-inbound@hiredesk.io',
    receivedAt: new Date(),
  });

  const noCodeEmail = 'From: mystery@applicant.com\r\nSubject: Candidate Inquiry\r\n\r\nI would love to work for you!';
  const noCodeResult = await processInboundEmail(noCodeRecord.id, noCodeEmail);
  console.log(`[PASS] No-code processing result: status = ${noCodeResult.status}`);
  console.log(`       failureReason = ${noCodeResult.failureReason}`);

  if (noCodeResult.status !== InboundStatus.UNMATCHED || noCodeResult.failureReason !== 'no_job_code') {
    throw new Error(`Expected UNMATCHED with no_job_code, got ${noCodeResult.status}`);
  }

  console.log('\n================================================================');
  console.log(' ALL PHASE 4 LIVE INTEGRATION CHECKS PASSED SUCCESSFULLY! ');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

runEndToEndVerification().catch(async (err) => {
  console.error('\n[FAIL] Phase 4 Verification Failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
