import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import { prisma } from './packages/database/dist/index.js';
import { defaultDaemon, ImapWorkerDaemon, ImapFlowFetcher } from './apps/worker/dist/imapClient.js';
import { InboundStatus, ApplicationStage } from './packages/shared/dist/index.js';

async function runLiveEmailIntegrationTest() {
  console.log('================================================================================');
  console.log('=== HiredeskHR — Live End-to-End Gmail IMAP & Inbound Processing Test        ===');
  console.log('================================================================================\n');

  const timestamp = Date.now();
  const testCandidateName = `Jordan Lee (Live Test ${timestamp.toString().slice(-4)})`;
  const testCandidateEmail = `jordan.lee.${timestamp}@example.com`;
  const targetJobCode = 'JOB-1003';

  // ---------------------------------------------------------------------------
  // STEP 1: Verify target job exists in Supabase DB
  // ---------------------------------------------------------------------------
  console.log(`[STEP 1] Verifying target job ${targetJobCode} in Supabase PostgreSQL...`);
  const job = await prisma.job.findUnique({
    where: { jobCode: targetJobCode },
    include: { organization: true, client: true },
  });

  if (!job) {
    throw new Error(`Target job ${targetJobCode} not found in database.`);
  }

  console.log(`[PASS] Found target job: ${job.jobCode} - "${job.title}"`);
  console.log(`       Organization: ${job.organization.name} (${job.organization.id})`);
  console.log(`       Client:       ${job.client.name} (${job.client.id})\n`);

  // ---------------------------------------------------------------------------
  // STEP 2: Dispatch realistic PyjamaHR application email via Gmail SMTP
  // ---------------------------------------------------------------------------
  console.log(`[STEP 2] Dispatching PyjamaHR application email to ${process.env.IMAP_USERNAME}...`);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, ''),
    },
  });

  // Minimal valid PDF binary
  const samplePdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n188\n%%EOF',
    'utf-8'
  );

  const emailSubject = `Application received for Senior Backend Engineer (${targetJobCode}) [REF-${timestamp}]`;
  const emailBody = `Dear Recruiting Team,

A candidate has submitted an application for ${targetJobCode} via PyjamaHR:

Name: ${testCandidateName}
Email: ${testCandidateEmail}
Phone: +1 555-0199
Location: New York, NY

Please find the candidate resume attached.

Regards,
PyjamaHR Application Relay`;

  const sendResult = await transporter.sendMail({
    from: `"PyjamaHR Notifications" <${process.env.SMTP_USERNAME}>`,
    to: process.env.IMAP_USERNAME,
    subject: emailSubject,
    text: emailBody,
    attachments: [
      {
        filename: 'jordan_lee_resume.pdf',
        content: samplePdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  console.log(`[PASS] Email dispatched to Gmail! Message ID: ${sendResult.messageId}`);
  console.log('       Waiting 6 seconds for Google IMAP index synchronization...\n');
  await new Promise((resolve) => setTimeout(resolve, 6000));

  // ---------------------------------------------------------------------------
  // STEP 3: Run Worker Poll Cycle over live Gmail IMAP
  // ---------------------------------------------------------------------------
  console.log('[STEP 3] Running Worker Daemon poll cycle over live Gmail IMAP...');
  const daemon = new ImapWorkerDaemon();
  await daemon.pollCycle();
  await daemon.stop();
  console.log('[PASS] Poll cycle completed and IMAP connection closed cleanly.\n');

  // ---------------------------------------------------------------------------
  // STEP 4: Verify Candidate and Application persisted in Database
  // ---------------------------------------------------------------------------
  console.log('[STEP 4] Verifying database records created by worker...');

  const inboundRecord = await prisma.inboundApplication.findFirst({
    where: {
      extractedJobCode: targetJobCode,
      subject: emailSubject,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!inboundRecord) {
    throw new Error('InboundApplication record not found in database.');
  }

  console.log(`[PASS] Inbound record found: ID ${inboundRecord.id}`);
  console.log(`       Status:         ${inboundRecord.status}`);
  console.log(`       Matched Job ID: ${inboundRecord.matchedJobId}`);
  console.log(`       Candidate ID:   ${inboundRecord.linkedCandidateId}`);
  console.log(`       Application ID: ${inboundRecord.linkedApplicationId}`);

  if (inboundRecord.status !== InboundStatus.MATCHED) {
    throw new Error(`Expected MATCHED status, got: ${inboundRecord.status} (Reason: ${inboundRecord.failureReason})`);
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: inboundRecord.linkedCandidateId },
    include: { resumes: true },
  });

  if (!candidate) {
    throw new Error(`Candidate ${inboundRecord.linkedCandidateId} not found in database.`);
  }

  console.log(`[PASS] Candidate persisted: "${candidate.name}" (${candidate.normalizedEmail})`);
  console.log(`       Code:     ${candidate.candidateCode}`);
  console.log(`       Phone:    ${candidate.phone}`);
  console.log(`       Location: ${candidate.location}`);
  console.log(`       Resumes:  ${candidate.resumes.length} attached`);

  const application = await prisma.application.findUnique({
    where: { id: inboundRecord.linkedApplicationId },
    include: { stageHistories: true },
  });

  if (!application) {
    throw new Error(`Application ${inboundRecord.linkedApplicationId} not found in database.`);
  }

  console.log(`[PASS] Application verified:`);
  console.log(`       Stage:           ${application.stage}`);
  console.log(`       Source:          ${application.source}`);
  console.log(`       Stage Histories: ${application.stageHistories.length}`);

  // ---------------------------------------------------------------------------
  // STEP 5: Idempotency & Duplicate Prevention Test
  // ---------------------------------------------------------------------------
  console.log('\n[STEP 5] Testing worker idempotency (re-running poll cycle)...');
  const countBefore = await prisma.application.count({ where: { jobId: job.id } });
  
  const secondDaemon = new ImapWorkerDaemon();
  await secondDaemon.pollCycle();
  await secondDaemon.stop();

  const countAfter = await prisma.application.count({ where: { jobId: job.id } });

  if (countBefore !== countAfter) {
    throw new Error(`Idempotency failure! Application count increased from ${countBefore} to ${countAfter}`);
  }

  console.log(`[PASS] Worker restarted cleanly. Application count unchanged (${countBefore} = ${countAfter}).`);
  console.log('       Zero duplicate records created!\n');

  console.log('================================================================================');
  console.log('=== [SUCCESS] Real-World Gmail IMAP Ingestion Verified End-to-End!           ===');
  console.log('================================================================================\n');
}

runLiveEmailIntegrationTest()
  .catch((err) => {
    console.error('\n[FAIL] Test encountered error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
