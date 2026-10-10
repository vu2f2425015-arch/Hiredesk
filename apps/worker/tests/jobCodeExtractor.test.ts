import { describe, it, expect } from 'vitest';
import { extractJobCode, normalizeJobCodeString, findJobCodesInText } from '../src/jobCodeExtractor.js';

describe('Job Code Extractor & Normalizer', () => {
  it('extracts standard JOB-1001 from subject line', () => {
    const res = extractJobCode('Application for Backend Engineer JOB-1001');
    expect(res.jobCode).toBe('JOB-1001');
    expect(res.source).toBe('subject');
    expect(res.isAmbiguous).toBe(false);
  });

  it('normalizes case variations (job-1002, Job-1003)', () => {
    const res1 = extractJobCode('Candidate applied for job-1002');
    expect(res1.jobCode).toBe('JOB-1002');

    const res2 = extractJobCode('Application: Job-1003 Senior Lead');
    expect(res2.jobCode).toBe('JOB-1003');
  });

  it('normalizes whitespace variants (JOB - 1004, JOB  -  1005)', () => {
    const res1 = extractJobCode('New applicant: JOB - 1004');
    expect(res1.jobCode).toBe('JOB-1004');

    const res2 = extractJobCode('Inbound candidate: job  -  1005');
    expect(res2.jobCode).toBe('JOB-1005');
  });

  it('normalizes dash variants (en-dash, em-dash, minus)', () => {
    // en-dash (\u2013)
    const enDashRes = extractJobCode('Frontend Dev JOB\u20131006');
    expect(enDashRes.jobCode).toBe('JOB-1006');

    // em-dash (\u2014)
    const emDashRes = extractJobCode('Fullstack Engineer JOB\u20141007');
    expect(emDashRes.jobCode).toBe('JOB-1007');
  });

  it('JOB-1005 does not match JOB-10050', () => {
    const codes = findJobCodesInText('Applicant for opening JOB-10050');
    expect(codes).toEqual(['JOB-10050']);
    expect(codes).not.toContain('JOB-1005');

    const res = extractJobCode('Application for JOB-10050');
    expect(res.jobCode).toBe('JOB-10050');
    expect(res.jobCode).not.toBe('JOB-1005');
  });

  it('falls back to email plain-text body if subject line lacks a code', () => {
    const subject = 'Application from John Doe';
    const body = 'Hello team, I am applying for the opening listed as JOB-2001 in your portal.';
    const res = extractJobCode(subject, body);
    expect(res.jobCode).toBe('JOB-2001');
    expect(res.source).toBe('body');
  });

  it('falls back to safely stripped HTML body when subject and plain text have no code', () => {
    const subject = 'Application from Jane Doe';
    const textBody = 'Please review my resume attached below.';
    const htmlBody = '<p>Regarding position <strong>JOB&nbsp;-&nbsp;3005</strong> at your firm</p>';
    const res = extractJobCode(subject, textBody, htmlBody);
    expect(res.jobCode).toBe('JOB-3005');
    expect(res.source).toBe('html');
  });

  it('flags ambiguous multiple distinct job codes in subject line', () => {
    const subject = 'Regarding JOB-1001 and JOB-1002';
    const res = extractJobCode(subject);
    expect(res.jobCode).toBeNull();
    expect(res.isAmbiguous).toBe(true);
    expect(res.candidatesFound).toHaveLength(2);
  });

  it('flags ambiguous multiple distinct job codes in body', () => {
    const subject = 'Application for Engineering';
    const body = 'I am interested in either JOB-1001 or JOB-1002';
    const res = extractJobCode(subject, body);
    expect(res.jobCode).toBeNull();
    expect(res.isAmbiguous).toBe(true);
    expect(res.candidatesFound).toHaveLength(2);
  });

  it('rejects malformed tokens (JOB-ABC, JOB-)', () => {
    const res1 = extractJobCode('Ref: JOB-ABC in subject');
    expect(res1.jobCode).toBeNull();

    const res2 = extractJobCode('Ref: JOB- trailing');
    expect(res2.jobCode).toBeNull();
  });

  it('returns null when no job code is present in subject or body', () => {
    const res = extractJobCode('General Inquiry', 'Just inquiring about open roles.');
    expect(res.jobCode).toBeNull();
    expect(res.source).toBeNull();
    expect(res.isAmbiguous).toBe(false);
  });

  it('normalizeJobCodeString helper works reliably', () => {
    expect(normalizeJobCodeString('job - 999')).toBe('JOB-999');
    expect(normalizeJobCodeString('invalid')).toBeNull();
  });
});
