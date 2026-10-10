export interface JobCodeExtractionResult {
  jobCode: string | null;
  source: 'subject' | 'body' | null;
  candidatesFound: string[];
  isAmbiguous: boolean;
}

const JOB_CODE_REGEX = /(?:^|[^a-zA-Z0-9])JOB\s*[-\u2010\u2011\u2012\u2013\u2014\u2212]\s*(\d+)(?=[^a-zA-Z0-9]|$)/gi;

/**
 * Normalizes any text matching JOB-<digits> variants into canonical 'JOB-<digits>'
 */
export function normalizeJobCodeString(rawToken: string): string | null {
  const match = /JOB\s*[-\u2010\u2011\u2012\u2013\u2014\u2212]\s*(\d+)/i.exec(rawToken);
  if (!match || !match[1]) {
    return null;
  }
  return `JOB-${match[1]}`;
}

/**
 * Finds all distinct normalized job codes in a block of text.
 */
export function findJobCodesInText(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const results = new Set<string>();
  const matches = text.matchAll(JOB_CODE_REGEX);

  for (const match of matches) {
    if (match[1]) {
      results.add(`JOB-${match[1]}`);
    }
  }

  return Array.from(results);
}

/**
 * Extracts and normalizes Job Code from email subject first, falling back to body.
 */
export function extractJobCode(subject: string, body?: string): JobCodeExtractionResult {
  // 1. Search subject line first
  const subjectCodes = findJobCodesInText(subject);

  if (subjectCodes.length === 1) {
    return {
      jobCode: subjectCodes[0],
      source: 'subject',
      candidatesFound: subjectCodes,
      isAmbiguous: false,
    };
  }

  if (subjectCodes.length > 1) {
    return {
      jobCode: null,
      source: 'subject',
      candidatesFound: subjectCodes,
      isAmbiguous: true,
    };
  }

  // 2. Fall back to body if subject had zero matches
  if (body) {
    const bodyCodes = findJobCodesInText(body);

    if (bodyCodes.length === 1) {
      return {
        jobCode: bodyCodes[0],
        source: 'body',
        candidatesFound: bodyCodes,
        isAmbiguous: false,
      };
    }

    if (bodyCodes.length > 1) {
      return {
        jobCode: null,
        source: 'body',
        candidatesFound: bodyCodes,
        isAmbiguous: true,
      };
    }
  }

  // 3. No match found
  return {
    jobCode: null,
    source: null,
    candidatesFound: [],
    isAmbiguous: false,
  };
}
