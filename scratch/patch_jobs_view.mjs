import fs from 'fs';

const filePath = 'apps/web/src/pages/JobsView.tsx';
let file = fs.readFileSync(filePath, 'utf8');

// 1. Add ExternalLink and Globe to lucide-react imports if not present
if (!file.includes('ExternalLink')) {
  file = file.replace(
    '  Download,\n  User,',
    '  Download,\n  User,\n  ExternalLink,\n  Globe,'
  );
  if (!file.includes('ExternalLink')) {
    // CRLF
    file = file.replace(
      '  Download,\r\n  User,',
      '  Download,\r\n  User,\r\n  ExternalLink,\r\n  Globe,'
    );
  }
}

// 2. Add orgSlug in JobsView
const jobsViewOrgSlug = `  const orgSlug = profile?.organizationSlug || (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'agency';
`;

if (!file.includes('const orgSlug = profile?.organizationSlug')) {
  file = file.replace(
    '  const jobsCacheKey = orgId ? `hd_jobs_cache_${orgId}` : null;',
    `  const jobsCacheKey = orgId ? \`hd_jobs_cache_\${orgId}\` : null;\n${jobsViewOrgSlug}`
  );
}

// 3. Add Apply Page button to job card
const applyPageBtn = `                  {job.status === 'published' && (
                    <a
                      href={\`/career/\${orgSlug}/\${job.jobCode}\`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}
                      title="Open candidate application page in new tab"
                    >
                      <ExternalLink size={13} /> Apply Page
                    </a>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={() => setSelectedJob(job)}>
                    Details
                  </button>`;

file = file.replace(
  `                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={() => setSelectedJob(job)}>
                    Details
                  </button>`,
  applyPageBtn
);

// 4. Update JobDetailModal
file = file.replace(
  '  const { session } = useAuth();',
  `  const { session, profile } = useAuth();
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const orgSlug = profile?.organizationSlug || (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'agency';
  const publicJobUrl = \`\${window.location.origin}/career/\${orgSlug}/\${job.jobCode}\`;`
);

// 5. Add Candidate Application Link inside Job Details tab
const candidateLinkBox = `          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {job.status === 'published' && (
              <div style={{
                padding: '0.9rem 1.15rem',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Globe size={13} /> Candidate Application Link
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontFamily: 'monospace', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                    {publicJobUrl}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(publicJobUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                  >
                    {copiedLink ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={publicJobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} /> View as Candidate
                  </a>
                </div>
              </div>
            )}`;

file = file.replace(
  `          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>`,
  candidateLinkBox
);

fs.writeFileSync(filePath, file, 'utf8');
console.log('Successfully patched JobsView.tsx with direct candidate apply link actions!');

