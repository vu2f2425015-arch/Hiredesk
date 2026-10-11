import dotenv from 'dotenv';
dotenv.config();

import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { prisma } from './packages/database/dist/index.js';

// Parse command line arguments
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
const sendTestIdx = args.indexOf('--send-test');
const testRecipient = sendTestIdx !== -1 && args[sendTestIdx + 1] ? args[sendTestIdx + 1] : null;
const pollSample = args.includes('--poll-sample');

function printUsage() {
  console.log(`
================================================================================
  HiredeskHR — Hostinger IMAP & SMTP Operational Verification Suite
================================================================================

Usage:
  node verify_mail_services.mjs [options]

Options:
  --check-only           Test connection, TLS handshake, and credentials (default)
  --send-test <email>    Send a live test interview invitation with ICS calendar attachment
  --poll-sample          Inspect recent mailbox messages for PyjamaHR format matching
  -h, --help             Show this help menu
`);
}

async function verifyPrismaConnection() {
  console.log('\n--- 1. Supabase Database & Mail Queue State ---');
  try {
    await prisma.$connect();
    const inboundCount = await prisma.inboundApplication.count();
    const outboundCount = await prisma.outboundCommunication.count();
    console.log(`[PASS] Supabase PostgreSQL connected successfully.`);
    console.log(`       Inbound application records in database:  ${inboundCount}`);
    console.log(`       Outbound communication records in database: ${outboundCount}`);
    return true;
  } catch (err) {
    console.error(`[FAIL] Database connection error: ${err.message}`);
    return false;
  }
}

async function verifyImapConnection() {
  const host = process.env.IMAP_HOST || 'imap.gmail.com';
  const isGmail = host.includes('gmail.com');
  const providerLabel = isGmail ? 'Gmail' : host.includes('hostinger') ? 'Hostinger' : 'Custom';
  console.log(`\n--- 2. ${providerLabel} IMAP Email Ingestion (Inbound) ---`);

  const port = parseInt(process.env.IMAP_PORT || '993', 10);
  const secure = process.env.IMAP_SECURE !== 'false';
  const username = (process.env.IMAP_USERNAME || '').trim();
  const password = (process.env.IMAP_PASSWORD || '').trim().replace(/\s+/g, '');
  const mailbox = process.env.IMAP_MAILBOX || 'INBOX';

  console.log(`Configured Host:    ${host}:${port} (SSL/TLS: ${secure})`);
  console.log(`Configured User:    ${username || '[NOT SET]'}`);
  console.log(`Target Mailbox:     ${mailbox}`);

  if (!username || !password) {
    console.log(`\n[PENDING CONFIGURATION] ${providerLabel} IMAP credentials are not set in .env.`);
    console.log('To activate real email ingestion:');
    console.log('  1. Open .env');
    console.log('  2. Set IMAP_USERNAME="your-email@gmail.com"');
    console.log('  3. Set IMAP_PASSWORD="your-16-char-app-password"');
    if (isGmail) {
      console.log('     * Note: Gmail requires a 16-character "App Password" (not your main password).');
      console.log('       Create one at: https://myaccount.google.com/apppasswords');
      console.log('       Ensure IMAP is enabled at: https://mail.google.com/mail/u/0/#settings/fwdandpop');
    }
    console.log('  4. Re-run: npm run verify:mail\n');
    return { configured: false, connected: false };
  }

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: username,
      pass: password,
    },
    logger: false,
  });

  try {
    console.log(`Connecting to ${providerLabel} IMAP server...`);
    await client.connect();
    console.log(`[PASS] Successfully authenticated with ${providerLabel} IMAP server!`);

    const lock = await client.getMailboxLock(mailbox);
    try {
      const mbStatus = client.mailbox;
      console.log(`[PASS] Mailbox "${mailbox}" opened successfully.`);
      console.log(`       Total messages:  ${mbStatus ? mbStatus.exists : 'Unknown'}`);
      console.log(`       UIDVALIDITY:     ${mbStatus ? mbStatus.uidValidity : 'Unknown'}`);

      const unseen = await client.search({ seen: false });
      console.log(`       Unseen messages: ${unseen.length}`);

      if (pollSample && unseen.length > 0) {
        console.log('\n--- Inspecting First Unseen Message ---');
        const targetSeq = unseen[0];
        const fetched = await client.fetchOne(String(targetSeq), { envelope: true });
        if (fetched && fetched.envelope) {
          console.log(`       Subject:  ${fetched.envelope.subject}`);
          console.log(`       From:     ${fetched.envelope.from?.map((f) => f.address).join(', ')}`);
          console.log(`       Date:     ${fetched.envelope.date}`);
          console.log(`       MessageId:${fetched.envelope.messageId}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log('[PASS] IMAP session closed gracefully.');
    return { configured: true, connected: true };
  } catch (err) {
    console.error(`[FAIL] IMAP Connection/Auth failed: ${err.message}`);
    if (isGmail && (err.message.includes('Authentication') || err.message.includes('LOGIN'))) {
      console.error('       * Google Tip: Did you use an "App Password"? Standard Google account passwords are blocked by Gmail.');
      console.error('         Generate one at: https://myaccount.google.com/apppasswords');
      console.error('         Also ensure IMAP is enabled in Gmail Settings > Forwarding and POP/IMAP.');
    }
    return { configured: true, connected: false, error: err.message };
  }
}

async function verifySmtpConnection() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const isGmail = host.includes('gmail.com');
  const providerLabel = isGmail ? 'Gmail' : host.includes('hostinger') ? 'Hostinger' : 'Custom';
  console.log(`\n--- 3. ${providerLabel} SMTP Outbound Email Delivery (Outbox) ---`);

  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const username = (process.env.SMTP_USERNAME || '').trim();
  const password = (process.env.SMTP_PASSWORD || '').trim().replace(/\s+/g, '');
  const fromName = process.env.SMTP_FROM_NAME || 'HiredeskHR Development';
  const fromEmail = process.env.SMTP_FROM_EMAIL || username || 'noreply@hiredeskhr.com';

  console.log(`Configured Host:    ${host}:${port} (SSL/TLS: ${secure})`);
  console.log(`Configured User:    ${username || '[NOT SET]'}`);
  console.log(`From Header:        "${fromName}" <${fromEmail}>`);

  if (!username || !password) {
    console.log(`\n[PENDING CONFIGURATION] ${providerLabel} SMTP credentials are not set in .env.`);
    console.log('To activate real outgoing interview invitations & email dispatch:');
    console.log('  1. Open .env');
    console.log('  2. Set SMTP_USERNAME="your-email@gmail.com"');
    console.log('  3. Set SMTP_PASSWORD="your-16-char-app-password"');
    console.log('  4. Set SMTP_FROM_EMAIL="your-email@gmail.com"');
    console.log('  5. Re-run: npm run verify:mail\n');
    return { configured: false, connected: false };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: username,
      pass: password,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  try {
    console.log(`Verifying SMTP transport credentials with ${providerLabel}...`);
    await transporter.verify();
    console.log(`[PASS] Successfully verified ${providerLabel} SMTP transport!`);

    if (testRecipient) {
      console.log(`\nDispatching real test email with calendar invite to: ${testRecipient}...`);
      const testIcs = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//HiredeskHR//Test Verification//EN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:test-${Date.now()}@hiredeskhr.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${new Date(Date.now() + 86400000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTEND:${new Date(Date.now() + 90000000).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        'SUMMARY:HiredeskHR Live SMTP Verification Interview',
        'DESCRIPTION:This is a live test invitation dispatched via Hostinger SMTP.',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: testRecipient,
        subject: 'HiredeskHR SMTP & Calendar Integration Test',
        text: 'Hello!\n\nThis is a verification email from your HiredeskHR operational test suite confirming that Hostinger SMTP is live and working.',
        html: '<p>Hello!</p><p>This is a verification email from your <strong>HiredeskHR</strong> operational test suite confirming that <strong>Hostinger SMTP</strong> is live and functional.</p>',
        attachments: [
          {
            filename: 'invite.ics',
            content: testIcs,
            contentType: 'text/calendar; charset=utf-8; method=REQUEST',
          },
        ],
      });

      console.log(`[PASS] Test email dispatched successfully!`);
      console.log(`       Message ID: ${info.messageId}`);
    } else {
      console.log('       (To send a live test email, run: node verify_mail_services.mjs --send-test recipient@example.com)');
    }

    return { configured: true, connected: true };
  } catch (err) {
    console.error(`[FAIL] SMTP Transport verification failed: ${err.message}`);
    return { configured: true, connected: false, error: err.message };
  }
}

async function main() {
  if (helpRequested) {
    printUsage();
    process.exit(0);
  }

  console.log('================================================================================');
  console.log('       HiredeskHR Launch Readiness — Email & Mailbox Diagnostic Tool           ');
  console.log('================================================================================');

  const dbOk = await verifyPrismaConnection();
  const imapResult = await verifyImapConnection();
  const smtpResult = await verifySmtpConnection();

  console.log('\n================================================================================');
  console.log('                          Verification Summary                                  ');
  console.log('================================================================================');
  const imapLabel = (process.env.IMAP_HOST || '').includes('gmail') ? 'Gmail' : 'Hostinger';
  const smtpLabel = (process.env.SMTP_HOST || '').includes('gmail') ? 'Gmail' : 'Hostinger';

  console.log(`Database (Supabase PostgreSQL):    ${dbOk ? 'READY (Connected)' : 'ERROR'}`);
  console.log(`Inbound Mailbox (${imapLabel} IMAP):   ${imapResult.configured ? (imapResult.connected ? 'READY (Verified)' : 'FAILED') : 'BLOCKED (Credentials Needed)'}`);
  console.log(`Outbound Delivery (${smtpLabel} SMTP): ${smtpResult.configured ? (smtpResult.connected ? 'READY (Verified)' : 'FAILED') : 'BLOCKED (Credentials Needed)'}`);
  console.log('================================================================================\n');

  if (!imapResult.configured || !smtpResult.configured) {
    console.log(`NEXT STEP: Add your ${imapLabel} email address and App Password to .env to unblock live testing.`);
  } else if (imapResult.connected && smtpResult.connected) {
    console.log('STATUS: Both IMAP and SMTP are verified live! Platform is ready for real email workflows.');
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
