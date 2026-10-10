import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { extractJobCode, JobCodeExtractionResult } from './jobCodeExtractor.js';

export interface ParsedResumeAttachment {
  filename: string;
  contentType: string;
  size: number;
  buffer: Buffer;
}

export interface ParsedApplicationEmail {
  messageId: string | null;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  recipientEmail: string;
  receivedAt: Date;
  jobCodeResult: JobCodeExtractionResult;
  candidateName: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  candidateLocation: string | null;
  resumeAttachment: ParsedResumeAttachment | null;
  rawAttachmentsCount: number;
  hasOversizedAttachment: boolean;
  textBody: string;
  htmlBody: string;
}

const KNOWN_NOTIFICATION_EMAILS = [
  'notifications@pyjamahr.com',
  'noreply@pyjamahr.com',
  'no-reply@pyjamahr.com',
  'alerts@pyjamahr.com',
  'system@pyjamahr.com',
];

/**
 * Extracts candidate details and resume attachments from raw RFC822 email buffer.
 */
export async function parseApplicationEmail(
  rawEmail: Buffer | string
): Promise<ParsedApplicationEmail> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  const subject = parsed.subject || '';
  const textBody = parsed.text || '';
  const htmlBody = typeof parsed.html === 'string' ? parsed.html : '';

  const senderEmail = parsed.from?.value[0]?.address?.toLowerCase() || '';
  const senderName = parsed.from?.value[0]?.name || null;
  const recipientEmail = parsed.to
    ? Array.isArray(parsed.to)
      ? parsed.to[0]?.value[0]?.address?.toLowerCase() || ''
      : parsed.to.value[0]?.address?.toLowerCase() || ''
    : '';

  const messageId = parsed.messageId ? parsed.messageId.trim() : null;
  const receivedAt = parsed.date || new Date();

  // 1. Extract Job Code
  const jobCodeResult = extractJobCode(subject, textBody, htmlBody);

  // 2. Candidate Name extraction
  let candidateName: string | null = null;
  const combinedBody = `${textBody}\n${htmlBody.replace(/<[^>]+>/g, ' ')}`;

  const nameMatch = combinedBody.match(/(?:candidate(?:\s+name)?|applicant(?:\s+name)?|^name)\s*[:=-]\s*([^\r\n<]+)/im);
  if (nameMatch && nameMatch[1]) {
    candidateName = nameMatch[1].trim();
  } else if (senderName && !senderName.toLowerCase().includes('pyjamahr') && !senderName.toLowerCase().includes('notifications')) {
    // If senderName is e.g. "John Doe via PyjamaHR" -> extract "John Doe"
    const viaMatch = senderName.match(/^([^<]+?)(?:\s+via\s+.*|\s+from\s+.*)?$/i);
    if (viaMatch && viaMatch[1]) {
      candidateName = viaMatch[1].trim();
    }
  }

  // 3. Candidate Email extraction
  let candidateEmail: string | null = null;
  const emailMatch = combinedBody.match(
    /(?:candidate(?:\s+email)?|applicant(?:\s+email)?|^email(?:\s+id)?)\s*[:=-]\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/im
  );

  if (emailMatch && emailMatch[1]) {
    candidateEmail = emailMatch[1].trim().toLowerCase();
  } else if (parsed.replyTo?.value[0]?.address) {
    const replyAddress = parsed.replyTo.value[0].address.toLowerCase();
    if (!KNOWN_NOTIFICATION_EMAILS.includes(replyAddress)) {
      candidateEmail = replyAddress;
    }
  } else if (senderEmail && !KNOWN_NOTIFICATION_EMAILS.includes(senderEmail)) {
    candidateEmail = senderEmail;
  }

  // 4. Candidate Phone extraction
  let candidatePhone: string | null = null;
  const phoneMatch = combinedBody.match(/(?:phone|mobile|contact(?:\s+number)?)\s*[:=-]\s*([+\d\s().-]{7,25})/im);
  if (phoneMatch && phoneMatch[1]) {
    candidatePhone = phoneMatch[1].trim();
  }

  // 5. Candidate Location extraction
  let candidateLocation: string | null = null;
  const locationMatch = combinedBody.match(/(?:current\s+location|location|city)\s*[:=-]\s*([^\r\n<]+)/im);
  if (locationMatch && locationMatch[1]) {
    candidateLocation = locationMatch[1].trim();
  }

  // 6. Resume attachment extraction
  let resumeAttachment: ParsedResumeAttachment | null = null;
  let hasOversizedAttachment = false;
  const attachments = parsed.attachments || [];

  for (const att of attachments) {
    const filename = att.filename || 'attachment';
    const lowerName = filename.toLowerCase();
    const isDoc =
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.docx') ||
      lowerName.endsWith('.doc') ||
      att.contentType === 'application/pdf' ||
      att.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      att.contentType === 'application/msword';

    if (isDoc) {
      if (att.size > 10 * 1024 * 1024) {
        hasOversizedAttachment = true;
      }
      if (!resumeAttachment) {
        resumeAttachment = {
          filename,
          contentType: att.contentType,
          size: att.size,
          buffer: att.content,
        };
      }
    }
  }

  return {
    messageId,
    subject,
    senderEmail,
    senderName,
    recipientEmail,
    receivedAt,
    jobCodeResult,
    candidateName,
    candidateEmail,
    candidatePhone,
    candidateLocation,
    resumeAttachment,
    rawAttachmentsCount: attachments.length,
    hasOversizedAttachment,
    textBody,
    htmlBody,
  };
}
