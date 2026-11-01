import fs from 'fs';

let file = fs.readFileSync('apps/web/src/lib/api.ts', 'utf8');

const target = `export async function fetchTalentPoolCandidates(
  token: string,
  query?: TalentPoolQuery
): Promise<{
  candidates: TalentPoolCandidate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.skills) params.set('skills', query.skills);
  if (query?.location) params.set('location', query.location);
  if (query?.country) params.set('country', query.country);
  if (query?.candidateCode) params.set('candidateCode', query.candidateCode);
  if (query?.stage) params.set('stage', query.stage);
  if (query?.jobId) params.set('jobId', query.jobId);
  if (query?.jobCode) params.set('jobCode', query.jobCode);
  if (query?.source) params.set('source', query.source);
  if (query?.folderId) params.set('folderId', query.folderId);
  if (query?.appliedAfter) params.set('appliedAfter', query.appliedAfter);
  if (query?.appliedBefore) params.set('appliedBefore', query.appliedBefore);
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await apiFetch(\`/api/talent-pool/candidates?\${params.toString()}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });`;

const repl = `export async function fetchTalentPoolCandidates(
  token: string,
  query?: TalentPoolQuery,
  signal?: AbortSignal
): Promise<{
  candidates: TalentPoolCandidate[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (query?.search) params.set('search', query.search);
  if (query?.skills) params.set('skills', query.skills);
  if (query?.location) params.set('location', query.location);
  if (query?.country) params.set('country', query.country);
  if (query?.candidateCode) params.set('candidateCode', query.candidateCode);
  if (query?.stage) params.set('stage', query.stage);
  if (query?.jobId) params.set('jobId', query.jobId);
  if (query?.jobCode) params.set('jobCode', query.jobCode);
  if (query?.source) params.set('source', query.source);
  if (query?.folderId) params.set('folderId', query.folderId);
  if (query?.appliedAfter) params.set('appliedAfter', query.appliedAfter);
  if (query?.appliedBefore) params.set('appliedBefore', query.appliedBefore);
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));

  const res = await apiFetch(\`/api/talent-pool/candidates?\${params.toString()}\`, {
    headers: { Authorization: \`Bearer \${token}\` },
    signal,
  });`;

const normFile = file.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');
if (!normFile.includes(normTarget)) {
  console.error('Target not found in api.ts!');
  process.exit(1);
}
fs.writeFileSync('apps/web/src/lib/api.ts', normFile.replace(normTarget, repl), 'utf8');
console.log('Successfully updated api.ts with signal support!');
