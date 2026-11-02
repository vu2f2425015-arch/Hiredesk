import fs from 'fs';

// Helper for download function replacement
const robustDownloadFunction = `  const handleDownloadResume = async (appId: string) => {
    if (!token) return;
    setDownloadingResumeId(appId);
    try {
      const { signedUrl, filename } = await fetchResumeDownloadUrl(token, appId);
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error('Download request failed');
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'resume.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } catch {
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = filename || 'resume.pdf';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(\`Resume download failed: \${err.message}\`);
    } finally {
      setDownloadingResumeId(null);
    }
  };`;

// 1. CandidateProfileModal.tsx
let candidateModal = fs.readFileSync('apps/web/src/pages/CandidateProfileModal.tsx', 'utf8');

// Replace handleDownloadResume
candidateModal = candidateModal.replace(
  /  const handleDownloadResume = async \(appId: string\) => \{[\s\S]*?    \} finally \{\s*setDownloadingResumeId\(null\);\s*\}\s*\};/,
  robustDownloadFunction
);

// Fix modal wrapper
candidateModal = candidateModal.replace(
  'className="glass-card"',
  `style={{
          maxWidth: '920px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
        }}`
);

// Fix Header
candidateModal = candidateModal.replace(
  "background: 'rgba(255, 255, 255, 0.02)',",
  "background: 'var(--bg-surface)',"
);

// Fix Current Stage background
candidateModal = candidateModal.replace(
  "background: 'rgba(0, 0, 0, 0.25)',",
  "background: 'var(--bg-canvas)',"
);

// Fix Current Stage inputs
candidateModal = candidateModal.replace(
  `                      <select
                        value={selectedTargetStage}
                        onChange={(e) => setSelectedTargetStage(e.target.value)}
                        style={{
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.85rem',
                        }}
                      >`,
  `                      <select
                        value={selectedTargetStage}
                        onChange={(e) => setSelectedTargetStage(e.target.value)}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.85rem',
                          fontWeight: 500,
                        }}
                      >`
);

candidateModal = candidateModal.replace(
  `                      <input
                        type="text"
                        placeholder="Transition reason (e.g. Cleared round 1)..."
                        value={transitionReason}
                        onChange={(e) => setTransitionReason(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          padding: '0.45rem 0.75rem',
                          fontSize: '0.85rem',
                        }}
                      />`,
  `                      <input
                        type="text"
                        placeholder="Transition reason (e.g. Cleared round 1)..."
                        value={transitionReason}
                        onChange={(e) => setTransitionReason(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: '200px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.85rem',
                        }}
                      />`
);

// Fix AI provider badge
candidateModal = candidateModal.replace(
  `                          {aiEvaluation && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                background: aiEvaluation.provider === 'google_gemini' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                                color: aiEvaluation.provider === 'google_gemini' ? '#c084fc' : 'var(--text-muted)',
                              }}
                            >
                              {aiEvaluation.provider === 'google_gemini' ? 'Google Gemini' : 'Deterministic Baseline'}
                            </span>
                          )}`,
  `                          {aiEvaluation && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '4px',
                                background: 'rgba(99, 102, 241, 0.15)',
                                color: 'var(--primary)',
                                fontWeight: 700,
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {aiEvaluation.provider === 'google_gemini'
                                ? 'Google Gemini'
                                : aiEvaluation.provider === 'openai'
                                ? 'OpenAI GPT-4o'
                                : 'Hiredesk AI Engine'}
                            </span>
                          )}`
);

// Fix AI stats container
candidateModal = candidateModal.replace(
  "background: 'rgba(0, 0, 0, 0.2)',",
  "background: 'var(--bg-canvas)',"
);

// Fix Footer
candidateModal = candidateModal.replace(
  `        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >`,
  `        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-surface)',
            zIndex: 10,
          }}
        >`
);

fs.writeFileSync('apps/web/src/pages/CandidateProfileModal.tsx', candidateModal, 'utf8');
console.log('Successfully patched CandidateProfileModal.tsx');

// 2. JobPipelineView.tsx
let pipelineView = fs.readFileSync('apps/web/src/pages/JobPipelineView.tsx', 'utf8');
const pipelineDownloadRegex = /  const handleDownloadResume = async \(applicationId: string\) => \{[\s\S]*?    \} finally \{\s*setDownloadingResumeId\(null\);\s*\}\s*\};/;
const pipelineRobustDownload = `  const handleDownloadResume = async (applicationId: string) => {
    if (!token) return;
    setDownloadingResumeId(applicationId);
    try {
      const { signedUrl, filename } = await fetchResumeDownloadUrl(token, applicationId);
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error('Download request failed');
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'resume.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } catch {
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = filename || 'resume.pdf';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(\`Download failed: \${err.message}\`);
    } finally {
      setDownloadingResumeId(null);
    }
  };`;

pipelineView = pipelineView.replace(pipelineDownloadRegex, pipelineRobustDownload);
fs.writeFileSync('apps/web/src/pages/JobPipelineView.tsx', pipelineView, 'utf8');
console.log('Successfully patched JobPipelineView.tsx');

// 3. JobsView.tsx
let jobsView = fs.readFileSync('apps/web/src/pages/JobsView.tsx', 'utf8');
const jobsViewDownloadRegex = /  const handleDownloadResume = async \(applicationId: string\) => \{[\s\S]*?    \} finally \{\s*setDownloadingResumeId\(null\);\s*\}\s*\};/;
const jobsViewRobustDownload = `  const handleDownloadResume = async (applicationId: string) => {
    if (!token) return;
    setDownloadingResumeId(applicationId);
    try {
      const { signedUrl, filename } = await fetchResumeDownloadUrl(token, applicationId);
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error('Download request failed');
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'resume.pdf';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      } catch {
        const a = document.createElement('a');
        a.href = signedUrl;
        a.download = filename || 'resume.pdf';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(\`Download failed: \${err.message}\`);
    } finally {
      setDownloadingResumeId(null);
    }
  };`;

jobsView = jobsView.replace(jobsViewDownloadRegex, jobsViewRobustDownload);
fs.writeFileSync('apps/web/src/pages/JobsView.tsx', jobsView, 'utf8');
console.log('Successfully patched JobsView.tsx');

