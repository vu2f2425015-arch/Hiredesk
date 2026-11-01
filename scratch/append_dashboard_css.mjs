import fs from 'fs';

const cssPath = 'c:/MY PROJECTS/Hiredesk/apps/web/src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

// Replace .dashboard-stats definition to be 4 columns on desktop
css = css.replace(
  '.dashboard-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }',
  '.dashboard-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }'
);

const newStyles = `
/* ==========================================================================
   HiredeskHR Executive Branded Dashboard & Agency Toolkit Styles
   ========================================================================== */

/* Branded Hero Header */
.dashboard-hero-card {
  position: relative;
  overflow: hidden;
  padding: 24px 28px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  background: var(--bg-surface);
  box-shadow: var(--shadow-dashboard);
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.dashboard-hero-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #3b82f6 100%);
}

.dashboard-hero-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dashboard-hero-eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.hero-brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  border: 1px solid rgba(99, 102, 241, 0.22);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.hero-badge-sparkle {
  color: #6366f1;
}

.hero-org-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: var(--bg-raised);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  font-size: 11px;
  font-weight: 600;
}

.hero-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
  font-size: 11px;
  font-weight: 600;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse-glow 2s infinite ease-in-out;
}

@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.dashboard-hero-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.dashboard-hero-sub {
  margin: 0;
  max-width: 820px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.dashboard-hero-sub strong {
  color: var(--text-primary);
  font-weight: 600;
}

.dashboard-hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.hero-btn-post {
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.25);
}

.hero-btn-share {
  background: var(--bg-surface);
}

.hero-btn-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--bg-surface);
  color: var(--text-secondary);
  transition: all 120ms ease;
}

.hero-btn-preview:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Stat Cards Upgrade */
.stat-card {
  padding: 0 !important;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-shadow: var(--shadow-dashboard);
  transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
}

.stat-card-inner {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 20px;
}

.stat-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card-label {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.stat-card-icon-wrap {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
}

.stat-card-icon-wrap.tone-primary {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
}

.stat-card-icon-wrap.tone-violet {
  background: rgba(147, 51, 234, 0.1);
  color: #9333ea;
}

.stat-card-icon-wrap.tone-emerald {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.stat-card-icon-wrap.tone-amber {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.stat-card-value-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.stat-card-value {
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.stat-card-badge {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
}

.stat-card-badge.tone-primary {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.stat-card-badge.tone-violet {
  background: rgba(147, 51, 234, 0.1);
  color: #9333ea;
  border: 1px solid rgba(147, 51, 234, 0.2);
}

.stat-card-badge.tone-emerald {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.stat-card-badge.tone-amber {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.stat-card-description {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

/* Application Pipeline Funnel Track */
.pipeline-panel {
  border-color: var(--border-subtle);
}

.pipeline-funnel-guide {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.funnel-steps-track {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
  border-radius: var(--radius-lg);
  background: var(--bg-raised);
  border: 1px solid var(--border-subtle);
}

.funnel-step-node {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
}

.funnel-step-node:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.funnel-step-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.funnel-step-num {
  font-size: 10px;
  font-weight: 750;
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
}

.funnel-step-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.funnel-step-count {
  font-size: 10.5px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.pipeline-empty-guide-content {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-raised);
  border: 1px dashed var(--border-default);
}

.guide-icon-banner {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 11px;
  background: var(--accent-subtle);
  color: var(--accent-text);
}

.guide-text {
  flex: 1;
}

.guide-text h3 {
  margin: 0 0 4px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.guide-text p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.guide-text code {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
}

.guide-action {
  flex: 0 0 auto;
}

/* Agency Recruitment Toolkit */
.agency-toolkit-section {
  display: block;
}

.toolkit-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.toolkit-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  box-shadow: 0 2px 8px rgba(17, 24, 39, 0.02);
  transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
}

.toolkit-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-dashboard);
}

.toolkit-card-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 11px;
}

.toolkit-card-icon.tone-primary {
  background: rgba(99, 102, 241, 0.1);
  color: #4f46e5;
}

.toolkit-card-icon.tone-emerald {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.toolkit-card-icon.tone-violet {
  background: rgba(147, 51, 234, 0.1);
  color: #9333ea;
}

.toolkit-card-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.toolkit-card-body h4 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
}

.toolkit-card-body p {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.45;
}

.toolkit-card-action {
  margin-top: 6px;
}

.inline-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-raised);
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 120ms ease;
}

.inline-action-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--accent-text);
}

.inline-action-btn code {
  font-size: 10.5px;
  background: transparent;
  padding: 0;
}

/* Dark Theme Adjustments for Executive Dashboard */
[data-theme="dark"] .dashboard-hero-card {
  background: linear-gradient(135deg, #111a2b 0%, #152238 100%);
  border-color: #273954;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
}

[data-theme="dark"] .hero-brand-badge {
  background: rgba(99, 102, 241, 0.18);
  border-color: rgba(129, 140, 248, 0.35);
  color: #c7d2fe;
}

[data-theme="dark"] .hero-org-tag {
  background: #162238;
  border-color: #2e4162;
  color: #cbd5e1;
}

[data-theme="dark"] .hero-status-pill {
  background: rgba(16, 185, 129, 0.14);
  border-color: rgba(16, 185, 129, 0.32);
  color: #6ee7b7;
}

[data-theme="dark"] .hero-btn-preview {
  background: #162238;
  border-color: #2d4060;
  color: #cbd5e1;
}

[data-theme="dark"] .hero-btn-preview:hover {
  background: #1d2b43;
  border-color: #556c96;
  color: #fff;
}

[data-theme="dark"] .funnel-steps-track {
  background: #0d1524;
  border-color: #253650;
}

[data-theme="dark"] .funnel-step-node {
  background: #131e33;
  border-color: #253650;
}

[data-theme="dark"] .funnel-step-node:hover {
  border-color: #625cf5;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .pipeline-empty-guide-content {
  background: #111a2b;
  border-color: #2b3d5c;
}

[data-theme="dark"] .toolkit-card {
  background: #111a2b;
  border-color: #253650;
}

[data-theme="dark"] .toolkit-card:hover {
  background: #152238;
  border-color: #3b5074;
}

[data-theme="dark"] .inline-action-btn {
  background: #162238;
  border-color: #2d4060;
  color: #d1d9e8;
}

[data-theme="dark"] .inline-action-btn:hover {
  background: #1e2c45;
  border-color: #52678d;
  color: #fff;
}

@media (max-width: 1024px) {
  .dashboard-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .funnel-steps-track {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .toolkit-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-stats {
    grid-template-columns: 1fr;
  }
  .funnel-steps-track {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dashboard-hero-card {
    padding: 18px 20px;
  }
  .dashboard-hero-title {
    font-size: 20px;
  }
  .dashboard-hero-actions {
    flex-direction: column;
    align-items: stretch;
  }
  .dashboard-hero-actions a,
  .dashboard-hero-actions button {
    justify-content: center;
  }
  .pipeline-empty-guide-content {
    flex-direction: column;
    align-items: flex-start;
  }
}
`;

css += '\n' + newStyles;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully appended dashboard styles to index.css');

