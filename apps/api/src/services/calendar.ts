/**
 * Pure RFC 5545 iCalendar (.ics) Generator
 * Generates valid iCalendar event strings with stable UIDs, UTC timestamps,
 * sequence tracking, and proper request/cancellation methods.
 *
 * NOTE: This produces standards-compliant .ics files that email clients
 * (Google Calendar, Apple Calendar, Outlook) can import. It does NOT claim
 * direct OAuth sync with Google/Microsoft APIs.
 */

export interface IcsEventOptions {
  interviewId: string;
  sequence: number; // 0 for initial, 1+ for reschedules
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  url?: string | null;
  organizerName?: string | null;
  organizerEmail?: string | null;
  attendeeName?: string | null;
  attendeeEmail?: string | null;
  isCancellation?: boolean;
}

/**
 * Format Date to iCalendar UTC string: YYYYMMDDTHHMMSSZ
 */
export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape text for iCalendar RFC 5545 compliance (backslash, comma, semicolon, newline)
 */
export function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Generate RFC 5545 .ics formatted calendar event
 */
export function generateIcsCalendar(options: IcsEventOptions): string {
  const uid = `interview-${options.interviewId}@hiredeskhr.com`;
  const dtStamp = formatIcsDate(new Date());
  const dtStart = formatIcsDate(new Date(options.startAt));
  const dtEnd = formatIcsDate(new Date(options.endAt));
  const method = options.isCancellation ? 'CANCEL' : 'REQUEST';
  const status = options.isCancellation ? 'CANCELLED' : 'CONFIRMED';

  const escapedSummary = escapeIcsText(options.summary);
  const escapedDescription = escapeIcsText(options.description);
  const location = options.url || options.location || 'Online / Video Call';
  const escapedLocation = escapeIcsText(location);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HiredeskHR//Interview Scheduler//EN',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `SEQUENCE:${Math.max(0, options.sequence)}`,
    `STATUS:${status}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapedSummary}`,
    `DESCRIPTION:${escapedDescription}`,
    `LOCATION:${escapedLocation}`,
  ];

  if (options.url) {
    lines.push(`URL:${escapeIcsText(options.url)}`);
  }

  if (options.organizerEmail) {
    const orgName = options.organizerName ? `CN=${escapeIcsText(options.organizerName)}:` : '';
    lines.push(`ORGANIZER;${orgName}mailto:${options.organizerEmail}`);
  }

  if (options.attendeeEmail) {
    const attName = options.attendeeName ? `CN=${escapeIcsText(options.attendeeName)}:` : '';
    lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;${attName}mailto:${options.attendeeEmail}`);
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n') + '\r\n';
}
