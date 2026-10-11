/**
 * Safe Escaped Email Templates for Interview Communications
 * Prevents HTML injection by escaping all user-supplied content.
 */

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDateTimeInTz(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(date));
  } catch {
    return new Date(date).toUTCString();
  }
}

export interface EmailTemplateParams {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  jobCode: string;
  clientName: string;
  interviewerName: string;
  interviewerEmail: string;
  interviewType: string;
  startAt: Date;
  endAt: Date;
  timeZone: string;
  meetingUrl?: string | null;
  location?: string | null;
  reason?: string | null;
  appPublicUrl?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * 1. Interview Invitation to Candidate
 */
export function renderCandidateInvitation(params: EmailTemplateParams): RenderedEmail {
  const safeCandidate = escapeHtml(params.candidateName);
  const safeJobTitle = escapeHtml(params.jobTitle);
  const safeJobCode = escapeHtml(params.jobCode);
  const safeClient = escapeHtml(params.clientName);
  const safeInterviewer = escapeHtml(params.interviewerName);
  const safeType = escapeHtml(params.interviewType.toUpperCase());
  const safeMeetingUrl = params.meetingUrl ? escapeHtml(params.meetingUrl) : null;
  const safeLocation = params.location ? escapeHtml(params.location) : null;

  const formattedStart = formatDateTimeInTz(params.startAt, params.timeZone);
  const formattedEnd = formatDateTimeInTz(params.endAt, params.timeZone);

  const subject = `Interview Invitation: ${params.jobTitle} (${params.jobCode})`;

  const text = `Dear ${params.candidateName},

We are pleased to invite you to an interview for the ${params.jobTitle} position (${params.jobCode}) with ${params.clientName}.

Interview Details:
- Date & Time: ${formattedStart} to ${formattedEnd}
- Timezone: ${params.timeZone}
- Interview Mode: ${params.interviewType.toUpperCase()}
- Interviewer: ${params.interviewerName}
${params.meetingUrl ? `- Meeting Link: ${params.meetingUrl}\n` : ''}${params.location ? `- Location: ${params.location}\n` : ''}
A calendar (.ics) invitation has been attached to this email.

Best regards,
The Recruitment Team
HiredeskHR`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .details { background: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .row { margin-bottom: 8px; font-size: 14px; }
    .label { font-weight: 600; color: #475569; width: 140px; display: inline-block; }
    .value { color: #0f172a; }
    .btn { display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 12px; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Interview Invitation</h1>
      <div class="subtitle">${safeJobTitle} (${safeJobCode}) at ${safeClient}</div>
    </div>
    <p>Dear ${safeCandidate},</p>
    <p>We are pleased to invite you to an interview for the <strong>${safeJobTitle}</strong> position.</p>
    <div class="details">
      <div class="row"><span class="label">Start Time:</span> <span class="value">${escapeHtml(formattedStart)}</span></div>
      <div class="row"><span class="label">End Time:</span> <span class="value">${escapeHtml(formattedEnd)}</span></div>
      <div class="row"><span class="label">Time Zone:</span> <span class="value">${escapeHtml(params.timeZone)}</span></div>
      <div class="row"><span class="label">Format:</span> <span class="value">${safeType}</span></div>
      <div class="row"><span class="label">Interviewer:</span> <span class="value">${safeInterviewer}</span></div>
      ${safeLocation ? `<div class="row"><span class="label">Location:</span> <span class="value">${safeLocation}</span></div>` : ''}
    </div>
    ${
      safeMeetingUrl
        ? `<p style="margin-top: 16px;"><a href="${safeMeetingUrl}" class="btn" target="_blank" rel="noopener noreferrer">Join Video Meeting</a></p>
           <p style="font-size: 12px; color: #64748b;">Meeting URL: <a href="${safeMeetingUrl}">${safeMeetingUrl}</a></p>`
        : ''
    }
    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
      A calendar invite file (.ics) is attached to this email so you can add this appointment directly to your calendar.
    </p>
    <div class="footer">
      Sent via HiredeskHR ATS &bull; Please do not reply directly to this automated email.
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * 2. Interview Scheduled Notice to Client
 */
export function renderClientInterviewNotice(params: EmailTemplateParams): RenderedEmail {
  const safeCandidate = escapeHtml(params.candidateName);
  const safeJobTitle = escapeHtml(params.jobTitle);
  const safeJobCode = escapeHtml(params.jobCode);
  const safeInterviewer = escapeHtml(params.interviewerName);
  const safeType = escapeHtml(params.interviewType.toUpperCase());
  const safeMeetingUrl = params.meetingUrl ? escapeHtml(params.meetingUrl) : null;

  const formattedStart = formatDateTimeInTz(params.startAt, params.timeZone);
  const formattedEnd = formatDateTimeInTz(params.endAt, params.timeZone);

  const subject = `Interview Confirmed: ${params.candidateName} for ${params.jobTitle} (${params.jobCode})`;

  const text = `Hello,

An interview has been coordinated and scheduled for candidate ${params.candidateName} for the ${params.jobTitle} opening (${params.jobCode}).

Interview Details:
- Candidate: ${params.candidateName}
- Date & Time: ${formattedStart} to ${formattedEnd} (${params.timeZone})
- Format: ${params.interviewType.toUpperCase()}
- Assigned Interviewer: ${params.interviewerName}
${params.meetingUrl ? `- Meeting URL: ${params.meetingUrl}\n` : ''}
You can review the candidate profile and live pipeline in your client portal.

Best regards,
HiredeskHR Recruitment Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #06b6d4; padding-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .details { background: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .row { margin-bottom: 8px; font-size: 14px; }
    .label { font-weight: 600; color: #475569; width: 140px; display: inline-block; }
    .value { color: #0f172a; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Interview Coordinated &amp; Scheduled</h1>
      <div class="subtitle">${safeJobTitle} (${safeJobCode})</div>
    </div>
    <p>Hello,</p>
    <p>An interview has been coordinated and scheduled for candidate <strong>${safeCandidate}</strong>.</p>
    <div class="details">
      <div class="row"><span class="label">Candidate:</span> <span class="value">${safeCandidate}</span></div>
      <div class="row"><span class="label">Schedule:</span> <span class="value">${escapeHtml(formattedStart)} &ndash; ${escapeHtml(formattedEnd)}</span></div>
      <div class="row"><span class="label">Time Zone:</span> <span class="value">${escapeHtml(params.timeZone)}</span></div>
      <div class="row"><span class="label">Format:</span> <span class="value">${safeType}</span></div>
      <div class="row"><span class="label">Interviewer:</span> <span class="value">${safeInterviewer}</span></div>
      ${safeMeetingUrl ? `<div class="row"><span class="label">Meeting Link:</span> <span class="value"><a href="${safeMeetingUrl}">${safeMeetingUrl}</a></span></div>` : ''}
    </div>
    <div class="footer">
      Sent via HiredeskHR Client Portal Notifications
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * 3. Interview Rescheduled Notice
 */
export function renderInterviewRescheduled(params: EmailTemplateParams): RenderedEmail {
  const safeCandidate = escapeHtml(params.candidateName);
  const safeJobTitle = escapeHtml(params.jobTitle);
  const safeJobCode = escapeHtml(params.jobCode);
  const safeInterviewer = escapeHtml(params.interviewerName);
  const safeType = escapeHtml(params.interviewType.toUpperCase());
  const safeMeetingUrl = params.meetingUrl ? escapeHtml(params.meetingUrl) : null;
  const safeReason = params.reason ? escapeHtml(params.reason) : null;

  const formattedStart = formatDateTimeInTz(params.startAt, params.timeZone);
  const formattedEnd = formatDateTimeInTz(params.endAt, params.timeZone);

  const subject = `Interview Rescheduled: ${params.jobTitle} - ${params.candidateName}`;

  const text = `Dear ${params.candidateName},

Your interview for the ${params.jobTitle} position (${params.jobCode}) has been rescheduled to a new time.

New Schedule:
- Date & Time: ${formattedStart} to ${formattedEnd}
- Timezone: ${params.timeZone}
- Interview Mode: ${params.interviewType.toUpperCase()}
- Interviewer: ${params.interviewerName}
${params.meetingUrl ? `- Meeting Link: ${params.meetingUrl}\n` : ''}${safeReason ? `- Reason: ${params.reason}\n` : ''}
An updated calendar (.ics) invitation has been attached to this email.

Best regards,
HiredeskHR Recruitment Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #f59e0b; padding-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .details { background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .row { margin-bottom: 8px; font-size: 14px; }
    .label { font-weight: 600; color: #92400e; width: 140px; display: inline-block; }
    .value { color: #78350f; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Interview Rescheduled</h1>
      <div class="subtitle">${safeJobTitle} (${safeJobCode})</div>
    </div>
    <p>Dear ${safeCandidate},</p>
    <p>Your interview for the <strong>${safeJobTitle}</strong> opening has been rescheduled to the updated time below:</p>
    <div class="details">
      <div class="row"><span class="label">New Start Time:</span> <span class="value">${escapeHtml(formattedStart)}</span></div>
      <div class="row"><span class="label">New End Time:</span> <span class="value">${escapeHtml(formattedEnd)}</span></div>
      <div class="row"><span class="label">Time Zone:</span> <span class="value">${escapeHtml(params.timeZone)}</span></div>
      <div class="row"><span class="label">Format:</span> <span class="value">${safeType}</span></div>
      <div class="row"><span class="label">Interviewer:</span> <span class="value">${safeInterviewer}</span></div>
      ${safeReason ? `<div class="row"><span class="label">Reason:</span> <span class="value">${safeReason}</span></div>` : ''}
      ${safeMeetingUrl ? `<div class="row"><span class="label">Meeting URL:</span> <span class="value"><a href="${safeMeetingUrl}">${safeMeetingUrl}</a></span></div>` : ''}
    </div>
    <p style="font-size: 13px; color: #64748b;">
      An updated calendar invite (.ics) has been attached to automatically update your calendar.
    </p>
    <div class="footer">
      Sent via HiredeskHR ATS &bull; Automated notification
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * 4. Interview Cancelled Notice
 */
export function renderInterviewCancelled(params: EmailTemplateParams): RenderedEmail {
  const safeCandidate = escapeHtml(params.candidateName);
  const safeJobTitle = escapeHtml(params.jobTitle);
  const safeJobCode = escapeHtml(params.jobCode);
  const safeReason = params.reason ? escapeHtml(params.reason) : null;

  const formattedStart = formatDateTimeInTz(params.startAt, params.timeZone);

  const subject = `Interview Cancelled: ${params.jobTitle} - ${params.candidateName}`;

  const text = `Dear ${params.candidateName},

This notice is to inform you that the interview scheduled for ${formattedStart} (${params.timeZone}) for the position of ${params.jobTitle} (${params.jobCode}) has been cancelled.
${params.reason ? `Reason: ${params.reason}\n` : ''}
If you have any questions or require further assistance, please contact the recruitment coordinator.

Best regards,
HiredeskHR Recruitment Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; }
    .header { margin-bottom: 24px; border-bottom: 2px solid #ef4444; padding-bottom: 16px; }
    .title { font-size: 20px; font-weight: 700; color: #991b1b; margin: 0; }
    .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
    .details { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .footer { margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1 class="title">Interview Cancelled</h1>
      <div class="subtitle">${safeJobTitle} (${safeJobCode})</div>
    </div>
    <p>Dear ${safeCandidate},</p>
    <p>This message is to notify you that the interview scheduled for <strong>${escapeHtml(formattedStart)} (${escapeHtml(params.timeZone)})</strong> has been cancelled.</p>
    ${
      safeReason
        ? `<div class="details">
            <strong>Reason:</strong> ${safeReason}
          </div>`
        : ''
    }
    <p style="font-size: 13px; color: #64748b;">
      A calendar cancellation update (.ics) has been attached to remove this event from your calendar.
    </p>
    <div class="footer">
      Sent via HiredeskHR ATS &bull; Automated notification
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}
