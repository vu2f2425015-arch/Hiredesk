import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  escapeHtml,
  formatDateTimeInTz,
  renderCandidateInvitation,
  renderClientInterviewNotice,
  renderInterviewRescheduled,
  renderInterviewCancelled,
} from '../src/services/emailTemplates.js';
import { generateIcsCalendar, formatIcsDate, escapeIcsText } from '../src/services/calendar.js';
import { EmailService } from '../src/services/email.js';
import { CommunicationStatus } from '@hiredesk/shared';

// Mock Prisma
vi.mock('@hiredesk/database', () => {
  const mockPrisma = {
    outboundCommunication: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '@hiredesk/database';

describe('Phase 7: Calendar Events, HTML Email Templates & SMTP Outbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EmailService.setCustomTransporter(null);
  });

  describe('1. HTML Sanitization & Email Templates', () => {
    it('escapes dangerous HTML/XSS payloads in user input', () => {
      const malicious = '<script>alert("xss")</script>&<img src=x onerror=alert(1)>"\'';
      const escaped = escapeHtml(malicious);

      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('<img');
      expect(escaped).toContain('&lt;script&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#039;');
    });

    it('renders candidate invitation with properly escaped fields and correct timezone format', () => {
      const startAt = new Date('2026-10-15T10:00:00Z');
      const endAt = new Date('2026-10-15T11:00:00Z');

      const rendered = renderCandidateInvitation({
        candidateName: 'John <Malicious> Doe',
        candidateEmail: 'john@example.com',
        jobTitle: 'Senior Fullstack Engineer <script>',
        jobCode: 'JOB-1001',
        clientName: 'Acme & Co',
        interviewerName: 'Jane Smith',
        interviewerEmail: 'jane@hiredeskhr.com',
        interviewType: 'video',
        startAt,
        endAt,
        timeZone: 'Asia/Kolkata',
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
      });

      expect(rendered.subject).toContain('JOB-1001');
      expect(rendered.subject).toContain('Senior Fullstack Engineer');

      // Verify HTML escaping
      expect(rendered.html).not.toContain('<Malicious>');
      expect(rendered.html).toContain('&lt;Malicious&gt;');
      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;');
      expect(rendered.html).toContain('Acme &amp; Co');
      expect(rendered.html).toContain('https://meet.google.com/abc-defg-hij');

      // Verify plain text version exists
      expect(rendered.text).toContain('John <Malicious> Doe');
      expect(rendered.text).toContain('Asia/Kolkata');
      expect(rendered.text).toContain('https://meet.google.com/abc-defg-hij');
    });

    it('renders interview reschedule notification with new schedule and reason', () => {
      const startAt = new Date('2026-10-16T14:00:00Z');
      const endAt = new Date('2026-10-16T15:00:00Z');

      const rendered = renderInterviewRescheduled({
        candidateName: 'Sarah Connor',
        candidateEmail: 'sarah@example.com',
        jobTitle: 'DevOps Specialist',
        jobCode: 'JOB-1002',
        clientName: 'Cyberdyne',
        interviewerName: 'Miles Dyson',
        interviewerEmail: 'miles@cyberdyne.com',
        interviewType: 'video',
        startAt,
        endAt,
        timeZone: 'UTC',
        reason: 'Interviewer had an urgent conflict',
      });

      expect(rendered.subject).toContain('Rescheduled');
      expect(rendered.html).toContain('Interviewer had an urgent conflict');
      expect(rendered.text).toContain('Interviewer had an urgent conflict');
    });

    it('renders interview cancellation notification with reason and polite wrap-up', () => {
      const startAt = new Date('2026-10-16T14:00:00Z');
      const endAt = new Date('2026-10-16T15:00:00Z');

      const rendered = renderInterviewCancelled({
        candidateName: 'Kyle Reese',
        candidateEmail: 'kyle@example.com',
        jobTitle: 'Security Lead',
        jobCode: 'JOB-1003',
        clientName: 'TechCorp',
        interviewerName: 'Sarah Smith',
        interviewerEmail: 'sarah@techcorp.com',
        interviewType: 'video',
        startAt,
        endAt,
        timeZone: 'UTC',
        reason: 'Position filled by earlier candidate',
      });

      expect(rendered.subject).toContain('Cancelled');
      expect(rendered.html).toContain('Position filled by earlier candidate');
      expect(rendered.text).toContain('Position filled by earlier candidate');
    });
  });

  describe('2. RFC 5545 iCalendar (.ics) Generator', () => {
    it('generates standards-compliant .ics with stable UID, sequence 0, and UTC timestamps', () => {
      const startAt = new Date('2026-10-15T10:00:00.000Z');
      const endAt = new Date('2026-10-15T11:00:00.000Z');

      const ics = generateIcsCalendar({
        interviewId: 'interview-uuid-1234',
        sequence: 0,
        summary: 'Interview: Senior Backend Engineer',
        description: 'Interview for John Doe with Acme Corp',
        startAt,
        endAt,
        location: 'Online',
        url: 'https://meet.google.com/xyz',
        organizerName: 'Recruiter Jane',
        organizerEmail: 'jane@agency.com',
        attendeeName: 'John Doe',
        attendeeEmail: 'john@gmail.com',
        isCancellation: false,
      });

      expect(ics).toContain('BEGIN:VCALENDAR\r\n');
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('METHOD:REQUEST\r\n');
      expect(ics).toContain('BEGIN:VEVENT\r\n');
      expect(ics).toContain('UID:interview-interview-uuid-1234@hiredeskhr.com\r\n');
      expect(ics).toContain('SEQUENCE:0\r\n');
      expect(ics).toContain('STATUS:CONFIRMED\r\n');
      expect(ics).toContain('DTSTART:20261015T100000Z\r\n');
      expect(ics).toContain('DTEND:20261015T110000Z\r\n');
      expect(ics).toContain('ORGANIZER;CN=Recruiter Jane:mailto:jane@agency.com\r\n');
      expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=John Doe:mailto:john@gmail.com\r\n');
      expect(ics).toContain('URL:https://meet.google.com/xyz\r\n');
      expect(ics).toContain('END:VEVENT\r\n');
      expect(ics).toContain('END:VCALENDAR\r\n');
    });

    it('generates cancellation event with METHOD:CANCEL and STATUS:CANCELLED', () => {
      const startAt = new Date('2026-10-15T10:00:00.000Z');
      const endAt = new Date('2026-10-15T11:00:00.000Z');

      const ics = generateIcsCalendar({
        interviewId: 'interview-uuid-1234',
        sequence: 1,
        summary: 'Cancelled: Senior Backend Engineer',
        description: 'This interview was cancelled',
        startAt,
        endAt,
        isCancellation: true,
      });

      expect(ics).toContain('METHOD:CANCEL\r\n');
      expect(ics).toContain('STATUS:CANCELLED\r\n');
      expect(ics).toContain('SEQUENCE:1\r\n');
    });

    it('properly escapes iCalendar special characters (comma, semicolon, backslash, newlines)', () => {
      const text = 'Line 1\nLine 2; with semicolons, and commas\\backslashes';
      const escaped = escapeIcsText(text);

      expect(escaped).toContain('Line 1\\nLine 2\\; with semicolons\\, and commas\\\\backslashes');
    });
  });

  describe('3. SMTP Delivery & Outbox Reliability', () => {
    it('honestly reports SMTP_NOT_CONFIGURED when SMTP credentials are absent', async () => {
      EmailService.setCustomTransporter(null);

      const result = await EmailService.sendMail({
        to: 'candidate@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
        html: '<p>Test Body</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SMTP_NOT_CONFIGURED');
      expect(result.error?.message).toContain('SMTP credentials are not configured');
      expect(result.error?.isTransient).toBe(false);
    });

    it('successfully sends email when transporter succeeds and updates status to sent', async () => {
      const mockTransporter: any = {
        sendMail: vi.fn().mockResolvedValue({
          messageId: '<msg-1234@mock-host>',
        }),
      };
      EmailService.setCustomTransporter(mockTransporter);

      (prisma.outboundCommunication.findUnique as any).mockResolvedValue({
        id: 'comm-1',
        recipientEmail: 'candidate@example.com',
        subject: 'Interview Scheduled',
        bodyText: 'Text',
        bodyHtml: '<p>Html</p>',
        status: CommunicationStatus.QUEUED,
        attemptCount: 0,
        maxAttempts: 5,
        metadata: { icsContent: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n' },
      });

      (prisma.outboundCommunication.update as any).mockResolvedValue({});

      const ok = await EmailService.processCommunicationRecord('comm-1');

      expect(ok).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'candidate@example.com',
          subject: 'Interview Scheduled',
        })
      );

      // Verify database marked as SENT with providerMessageId
      expect(prisma.outboundCommunication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-1' },
          data: expect.objectContaining({
            status: CommunicationStatus.SENT,
            providerMessageId: '<msg-1234@mock-host>',
          }),
        })
      );
    });

    it('handles transient network timeout by incrementing attempts and keeping queued for retry', async () => {
      const transientError = new Error('Connection timeout');
      (transientError as any).code = 'ETIMEDOUT';

      const mockTransporter: any = {
        sendMail: vi.fn().mockRejectedValue(transientError),
      };
      EmailService.setCustomTransporter(mockTransporter);

      (prisma.outboundCommunication.findUnique as any).mockResolvedValue({
        id: 'comm-transient',
        recipientEmail: 'candidate@example.com',
        subject: 'Interview Scheduled',
        status: CommunicationStatus.QUEUED,
        attemptCount: 1,
        maxAttempts: 5,
        metadata: {},
      });

      (prisma.outboundCommunication.update as any).mockResolvedValue({});

      const ok = await EmailService.processCommunicationRecord('comm-transient');

      expect(ok).toBe(false);
      // Status remains queued for retry because attemptCount (2) < maxAttempts (5)
      expect(prisma.outboundCommunication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-transient' },
          data: expect.objectContaining({
            status: CommunicationStatus.QUEUED,
            errorCode: 'ETIMEDOUT',
          }),
        })
      );
    });

    it('marks communication as FAILED when max attempts are exceeded or permanent error occurs', async () => {
      const permanentError = new Error('550 Mailbox does not exist');
      (permanentError as any).code = '550';

      const mockTransporter: any = {
        sendMail: vi.fn().mockRejectedValue(permanentError),
      };
      EmailService.setCustomTransporter(mockTransporter);

      (prisma.outboundCommunication.findUnique as any).mockResolvedValue({
        id: 'comm-permanent',
        recipientEmail: 'invalid@example.com',
        subject: 'Interview Scheduled',
        status: CommunicationStatus.QUEUED,
        attemptCount: 4, // 4 + 1 = 5 (exhausted)
        maxAttempts: 5,
        metadata: {},
      });

      (prisma.outboundCommunication.update as any).mockResolvedValue({});

      const ok = await EmailService.processCommunicationRecord('comm-permanent');

      expect(ok).toBe(false);
      expect(prisma.outboundCommunication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-permanent' },
          data: expect.objectContaining({
            status: CommunicationStatus.FAILED,
            errorCode: '550',
          }),
        })
      );
    });

    it('manual retry resets communication status to queued and attempts resend', async () => {
      const mockTransporter: any = {
        sendMail: vi.fn().mockResolvedValue({ messageId: '<retried-123>' }),
      };
      EmailService.setCustomTransporter(mockTransporter);

      (prisma.outboundCommunication.findFirst as any).mockResolvedValue({
        id: 'comm-retry',
        organizationId: 'org-1',
        status: CommunicationStatus.FAILED,
      });

      (prisma.outboundCommunication.findUnique as any).mockResolvedValue({
        id: 'comm-retry',
        recipientEmail: 'candidate@example.com',
        subject: 'Interview Retry',
        status: CommunicationStatus.QUEUED,
        attemptCount: 0,
        maxAttempts: 5,
        metadata: {},
      });

      (prisma.outboundCommunication.update as any).mockResolvedValue({});

      const success = await EmailService.retryCommunication('comm-retry', 'org-1');

      expect(success).toBe(true);
      expect(prisma.outboundCommunication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comm-retry' },
          data: expect.objectContaining({
            status: CommunicationStatus.SENT,
            providerMessageId: '<retried-123>',
          }),
        })
      );
    });
  });
});
