import fs from 'fs';

const cssPath = 'apps/web/src/index.css';
const css = fs.readFileSync(cssPath, 'utf8');

const careerCss = `
/* ============================================================================ */
/* Public Career Portal & Candidate Application UI                             */
/* ============================================================================ */

.career-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

.career-hero-card {
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: var(--radius-xl);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.career-hero-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 50%, #4f46e5 100%);
}

.career-org-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary);
  margin-bottom: 1rem;
}

.career-hero-title {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: -0.025em;
  margin: 0 0 0.5rem 0;
}

.career-hero-subtitle {
  color: var(--text-muted);
  font-size: 1.05rem;
  max-width: 520px;
  margin: 0 auto;
  line-height: 1.5;
}

.career-job-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: 2.25rem;
  box-shadow: var(--shadow-sm);
}

.career-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  margin-bottom: 1.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-sm);
  background: rgba(99, 102, 241, 0.08);
  border: 1px solid rgba(99, 102, 241, 0.2);
  transition: all 0.15s ease;
}

.career-back-btn:hover {
  background: rgba(99, 102, 241, 0.16);
  transform: translateX(-2px);
}

.career-code-pill {
  font-family: monospace;
  font-weight: 700;
  color: var(--primary);
  background: rgba(99, 102, 241, 0.12);
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
  font-size: 0.85rem;
  display: inline-block;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.career-meta-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.career-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.career-section-title {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.6rem 0;
}

.career-skill-tag {
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary);
  border: 1px solid rgba(99, 102, 241, 0.2);
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.career-apply-card {
  margin-top: 2rem;
  padding: 2.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.career-apply-card .form-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--text-main);
  margin: 0 0 0.35rem 0;
}

.career-apply-card .form-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin: 0 0 1.75rem 0;
}

.career-input-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.4rem;
}

.career-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--bg-canvas);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  color: var(--text-main);
  font-size: 0.925rem;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.career-input:focus {
  outline: none;
  border-color: var(--primary);
  background: var(--bg-surface);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.career-dropzone {
  border: 2px dashed var(--border-default);
  border-radius: var(--radius-lg);
  padding: 2.25rem 1.5rem;
  text-align: center;
  background: var(--bg-canvas);
  cursor: pointer;
  transition: all 0.2s ease;
}

.career-dropzone:hover {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.05);
}

.career-dropzone-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.12);
  color: var(--primary);
  margin-bottom: 0.75rem;
}

.career-dropzone-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 0.25rem;
}

.career-dropzone-subtext {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.career-file-preview {
  display: inline-flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.25rem;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
}

.career-faq-box {
  margin-top: 1.5rem;
  padding: 2rem;
  background: var(--bg-surface);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-sm);
}

.career-faq-item {
  background: var(--bg-canvas);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 0.85rem 1.15rem;
  transition: all 0.2s ease;
}

.career-faq-item[open] {
  border-color: rgba(99, 102, 241, 0.4);
  background: var(--bg-surface);
}

.career-faq-summary {
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  outline: none;
  color: var(--text-main);
}
`;

fs.writeFileSync(cssPath, css + careerCss, 'utf8');
console.log('Appended career portal CSS successfully!');

