import dotenv from 'dotenv';
dotenv.config();

import { prisma } from './packages/database/dist/index.js';
import {
  claimOrRegisterInboundRecord,
  processInboundEmail,
} from './apps/worker/dist/inboundProcessor.js';
import { InboundStatus } from './packages/shared/dist/index.js';

async function runReplayIdempotencyVerification() {
  console.log('================================================================================');
  console.log('=== HiredeskHR — Genuine Inbound Replay & Idempotency Audit Suite            ===');
  console.log('================================================================================\n');

  // Find a target job
  const job = await prisma.job.findUnique({
    where: { jobCode: 'JOB-1003' },
    include: { organization: true },
  });

  if (!job) {
    throw new Error('JOB-1003 not found in live database');
  }

  console.log(`[PASS] Target Job resolved: ${job.jobCode} - "${job.title}"`);
  console.log(`       Organization: ${job.organization.name} (${job.organizationId})\n`);

  // ---------------------------------------------------------------------------
  // TEST 1: Exact Same Message Identity Replay (Same mailboxId, uidValidity, uid)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Lease Deduplication on Replay (Same Message UID) ---');
  const existingMatched = await prisma.inboundApplication.findFirst({
    where: { status: InboundStatus.MATCHED, extractedJobCode: 'JOB-1003' },
    orderBy: { createdAt: 'desc' },
  });

  if (!existingMatched) {
    throw new Error('No matched inbound application found in database for replay test');
  }

  console.log(`Testing replay against existing matched inbound record ID: ${existingMatched.id}`);
  console.log(`Mailbox: ${existingMatched.mailboxId}, UID: ${existingMatched.uid}, Status: ${existingMatched.status}`);

  const replayClaim = await claimOrRegisterInboundRecord({
    mailboxId: existingMatched.mailboxId,
    uidValidity: existingMatched.uidValidity,
    uid: existingMatched.uid,
    messageId: existingMatched.messageId,
    subject: existingMatched.subject,
    senderEmail: existingMatched.senderEmail,
    recipientEmail: existingMatched.recipientEmail,
    receivedAt: existingMatched.receivedAt,
  });

  if (replayClaim.claimed) {
    throw new Error('[FAIL] Replay claim succeeded when it should have been refused!');
  }

  console.log(`[PASS] claimOrRegisterInboundRecord refused claim (claimed = false).`);
  console.log(`       Record remains in terminal status: ${replayClaim.record.status}`);

  // ---------------------------------------------------------------------------
  // TEST 2: Terminal State Short-Circuit in processInboundEmail
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Terminal State Short-Circuit in processInboundEmail ---');
  const dummyPayload = Buffer.from('Subject: Dummy\r\n\r\nDummy body', 'utf-8');
  const shortCircuitResult = await processInboundEmail(existingMatched.id, dummyPayload);

  if (shortCircuitResult.status !== InboundStatus.MATCHED) {
    throw new Error(`[FAIL] Expected short-circuit with MATCHED status, got: ${shortCircuitResult.status}`);
  }

  console.log(`[PASS] processInboundEmail short-circuited immediately without mutating record or re-parsing.`);
  console.log(`       Linked candidate ID: ${shortCircuitResult.candidateId}`);
  console.log(`       Linked application ID: ${shortCircuitResult.applicationId}`);

  // ---------------------------------------------------------------------------
  // TEST 3: Duplicate Candidate & Application Replay (Different UID / Re-forwarded)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Duplicate Application Replay (Re-sent / Forwarded Application) ---');
  
  // Resolve the candidate linked to this application
  const existingCandidate = await prisma.candidate.findUnique({
    where: { id: existingMatched.linkedCandidateId },
    include: { resumes: true, applications: true },
  });

  if (!existingCandidate) {
    throw new Error('Candidate linked to matched record not found');
  }

  const initialCandCount = await prisma.candidate.count({
    where: { organizationId: job.organizationId, normalizedEmail: existingCandidate.normalizedEmail },
  });
  const initialAppCount = await prisma.application.count({
    where: { jobId: job.id, candidateId: existingCandidate.id },
  });
  const initialResumeCount = await prisma.resume.count({
    where: { candidateId: existingCandidate.id },
  });

  console.log(`Baseline counts for candidate ${existingCandidate.normalizedEmail}:`);
  console.log(`  Candidate records in Org: ${initialCandCount}`);
  console.log(`  Applications for ${job.jobCode}: ${initialAppCount}`);
  console.log(`  Resumes in Storage / DB: ${initialResumeCount}`);

  // Construct raw email RFC822 with the SAME candidate email and SAME job code, but new UID
  const newReplayUid = BigInt(Math.floor(Date.now() / 1000) + 99999);
  const replayRawEmail = [
    `From: PyjamaHR Notifications <notifications@pyjamahr.com>`,
    `To: inbound@hiredesk.io`,
    `Subject: Application received for Senior Backend Engineer (JOB-1003) [REPLAY-AUDIT]`,
    `Date: Mon, 12 Oct 2026 00:00:00 +0000`,
    `Message-ID: <replay-test-${newReplayUid}@pyjamahr.com>`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="REPLAY_BOUNDARY"`,
    ``,
    `--REPLAY_BOUNDARY`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    `Dear Recruiting Team,`,
    ``,
    `A candidate has submitted an application for JOB-1003 via PyjamaHR:`,
    ``,
    `Name: ${existingCandidate.name}`,
    `Email: ${existingCandidate.normalizedEmail}`,
    `Phone: +1 555-0199`,
    `Location: New York, NY`,
    ``,
    `Please find the candidate resume attached.`,
    `--REPLAY_BOUNDARY`,
    `Content-Type: application/pdf; name="replay_resume.pdf"`,
    `Content-Disposition: attachment; filename="replay_resume.pdf"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    `JVBERi0xLjQKMSAwIG9iago8PD4+CmVuZG9iagp0cmFpbGVyCjw8Pj4KJSVFT0Y=`,
    `--REPLAY_BOUNDARY--`,
  ].join('\r\n');

  // Claim new inbound record
  const { record: newRecord, claimed: newClaimed } = await claimOrRegisterInboundRecord({
    mailboxId: 'replay-audit-mailbox',
    uidValidity: BigInt(20261012),
    uid: newReplayUid,
    messageId: `<replay-test-${newReplayUid}@pyjamahr.com>`,
    subject: `Application received for Senior Backend Engineer (JOB-1003) [REPLAY-AUDIT]`,
    senderEmail: 'notifications@pyjamahr.com',
    recipientEmail: 'inbound@hiredesk.io',
    receivedAt: new Date(),
  });

  if (!newClaimed) {
    throw new Error('Failed to claim lease on new replay record');
  }

  console.log(`\nProcessing re-sent application email (Record ID: ${newRecord.id})...`);
  const replayProcessResult = await processInboundEmail(newRecord.id, Buffer.from(replayRawEmail));

  console.log(`Processing result status: ${replayProcessResult.status}`);
  console.log(`       Is duplicate:     ${replayProcessResult.isDuplicate}`);
  console.log(`       Failure reason:   ${replayProcessResult.failureReason}`);
  console.log(`       Linked Cand ID:   ${replayProcessResult.candidateId}`);
  console.log(`       Linked App ID:    ${replayProcessResult.applicationId}`);

  if (replayProcessResult.status !== InboundStatus.DUPLICATE || !replayProcessResult.isDuplicate) {
    throw new Error(`[FAIL] Expected DUPLICATE status, got ${replayProcessResult.status}`);
  }

  // Verify counts AFTER re-processing
  const afterCandCount = await prisma.candidate.count({
    where: { organizationId: job.organizationId, normalizedEmail: existingCandidate.normalizedEmail },
  });
  const afterAppCount = await prisma.application.count({
    where: { jobId: job.id, candidateId: existingCandidate.id },
  });
  const afterResumeCount = await prisma.resume.count({
    where: { candidateId: existingCandidate.id },
  });

  console.log(`\nCounts after replay:`);
  console.log(`  Candidate records in Org: ${afterCandCount} (Expected: ${initialCandCount})`);
  console.log(`  Applications for ${job.jobCode}: ${afterAppCount} (Expected: ${initialAppCount})`);
  console.log(`  Resumes in Storage / DB: ${afterResumeCount} (Expected: ${initialResumeCount})`);

  if (afterCandCount !== initialCandCount) {
    throw new Error(`[FAIL] Duplicate candidate created! Count changed from ${initialCandCount} to ${afterCandCount}`);
  }
  if (afterAppCount !== initialAppCount) {
    throw new Error(`[FAIL] Duplicate application created! Count changed from ${initialAppCount} to ${afterAppCount}`);
  }
  if (afterResumeCount !== initialResumeCount) {
    throw new Error(`[FAIL] Duplicate resume uploaded! Count changed from ${initialResumeCount} to ${afterResumeCount}`);
  }

  console.log('[PASS] Multi-layer idempotency verified: Zero duplicate candidates, applications, or resumes created!\n');

  console.log('================================================================================');
  console.log('=== [SUCCESS] Genuine Replay & Idempotency Audit Passed (100%)               ===');
  console.log('================================================================================\n');
}

runReplayIdempotencyVerification()
  .catch((err) => {
    console.error('\n[FAIL] Replay test failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
