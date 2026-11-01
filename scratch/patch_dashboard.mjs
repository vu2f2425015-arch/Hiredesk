import fs from 'fs';
import path from 'path';

const filePath = 'C:/MY PROJECTS/Hiredesk/apps/web/src/pages/DashboardView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace imports
const oldImport = `import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Inbox,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Users,
  Layers,
  FileText,
  MailCheck,
  Activity,
  Check,
  Building2,
} from 'lucide-react';
import { ApplicationStage } from '@hiredesk/shared';
import { useAuth } from '../context/AuthContext';
import { DashboardMetrics, fetchDashboardAnalytics } from '../lib/api';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/shell/PageHeader';`;

const newImport = `import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Inbox,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Zap,
  Users,
  Layers,
  FileText,
  MailCheck,
  Activity,
  Check,
  Building2,
  Share2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { ApplicationStage } from '@hiredesk/shared';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DashboardMetrics, fetchDashboardAnalytics } from '../lib/api';
import { EmptyState } from '../components/ui/EmptyState';
import { StatCard } from '../components/ui/StatCard';`;

content = content.replace(/\r\n/g, '\n');
const normalizedOldImport = oldImport.replace(/\r\n/g, '\n');

if (!content.includes(normalizedOldImport)) {
  console.error('Could not find oldImport in DashboardView.tsx');
  process.exit(1);
}

content = content.replace(normalizedOldImport, newImport);

// 2. Replace export function DashboardView()
const dashboardFnIndex = content.indexOf('export function DashboardView()');
if (dashboardFnIndex === -1) {
  console.error('Could not find export function DashboardView');
  process.exit(1);
}

const newDashboardFn = `export function DashboardView() {
  const { session, profile } = useAuth();
  const { showToast, success: toastSuccess } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const token = session?.access_token;
  const cacheKey = profile?.organizationId ? \`hd_dashboard_cache_\${profile.organizationId}\` : null;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(() => readCachedMetrics(cacheKey));
  const [loading, setLoading] = useState(!metrics);
  const [error, setError] = useState<string | null>(null);

  const orgSlug = (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const careerUrl = \`\${window.location.origin}/career/\${orgSlug}\`;

  const handleCopyCareerLink = () => {
    navigator.clipboard.writeText(careerUrl).then(() => {
      setCopiedLink(true);
      toastSuccess('Career Portal Link Copied!', \`Share \${careerUrl} with candidates to receive applications.\`);
      setTimeout(() => setCopiedLink(false), 2500);
    }).catch(() => {
      showToast('Career portal URL: ' + careerUrl, { type: 'info' });
    });
  };

  const loadMetrics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardAnalytics(token);
      setMetrics(data);
      if (cacheKey) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, [token, cacheKey]);

  useEffect(() => {
    const cached = readCachedMetrics(cacheKey);
    setMetrics(cached);
    if (token) {
      void loadMetrics();
    } else {
      setLoading(false);
    }
  }, [token, cacheKey, loadMetrics]);

  if (!profile) return <PublicHome />;

  if (loading && !metrics) return <DashboardSkeleton />;

  return (
    <div className="dashboard-page">
      {/* Branded Executive Hero Header */}
      <section className="dashboard-hero-card" aria-label="Workspace overview">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-eyebrow">
            <span className="hero-brand-badge">
              <Sparkles size={12} className="hero-badge-sparkle" /> HiredeskHR ATS
            </span>
            <span className="hero-org-tag">
              <Building2 size={12} /> {profile.organizationName || 'Agency Workspace'}
            </span>
            <span className="hero-status-pill">
              <span className="pulse-dot" /> Live Pipeline
            </span>
          </div>

          <h1 className="dashboard-hero-title">
            HiredeskHR Dashboard
          </h1>

          <p className="dashboard-hero-sub">
            Welcome back, <strong>{profile.fullName || profile.firstName || 'Recruiter'}</strong>. Manage agency vacancies, candidate pipelines, and automated inbound resume matching for <strong>{profile.organizationName || 'your recruitment agency'}</strong> on HiredeskHR.
          </p>

          <div className="dashboard-hero-actions">
            <Link className="button-primary hero-btn-post" to="/jobs">
              <BriefcaseBusiness size={15} /> Post Job Vacancy
            </Link>
            <Link className="button-secondary" to="/interviews?schedule=1">
              <CalendarDays size={15} /> Schedule Interview
            </Link>
            <Link className="button-secondary" to="/unmatched">
              <Inbox size={15} /> Review Inbound
            </Link>
            <button
              type="button"
              className="button-secondary hero-btn-share"
              onClick={handleCopyCareerLink}
              title="Copy public career portal URL for candidates"
            >
              {copiedLink ? <Check size={14} color="var(--success)" /> : <Share2 size={14} />}
              {copiedLink ? 'Copied Link!' : 'Share Career Portal'}
            </button>
            <a
              href={\`/career/\${orgSlug}\`}
              target="_blank"
              rel="noreferrer"
              className="button-ghost hero-btn-preview"
              title="Preview Public Career Page"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>

      {error && metrics && (
        <div className="dashboard-inline-error" role="status">
          <span>Couldn’t refresh the dashboard. Showing the last loaded results.</span>
          <button type="button" className="text-button" onClick={() => void loadMetrics()}>Retry</button>
        </div>
      )}

      {error && !metrics && (
        <section className="dashboard-error" role="alert">
          <div>
            <h2>Dashboard data is unavailable</h2>
            <p>{error}</p>
            <Link to="/system-status" className="inline-link">Check system status</Link>
          </div>
          <button type="button" className="button-secondary" onClick={() => void loadMetrics()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'is-spinning' : undefined} /> Retry
          </button>
        </section>
      )}

      {metrics && (
        <>
          {metrics.totalJobs === 0 && metrics.totalCandidates === 0 && (
            <section className="onboarding-panel dashboard-roadmap" aria-labelledby="onboarding-title">
              <div className="roadmap-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', background: 'var(--primary-subtle)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <Sparkles size={12} /> QUICK START ROADMAP
                  </div>
                  <h2 id="onboarding-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Set up your recruitment workspace</h2>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Follow these essential steps to configure your pipeline and start receiving candidates.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0))} of 3 Completed ({Math.round((((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)) / 3) * 100)}%)
                  </span>
                  <div className="roadmap-progress-track" role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={3} aria-valuenow={(metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)}>
                    <div className="roadmap-progress-value" style={{ width: \`\${Math.round((((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)) / 3) * 100)}%\` }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Step 1 */}
                <div className={\`roadmap-step-card\${metrics.totalJobs === 0 ? ' roadmap-step-current' : ' roadmap-step-complete'}\`}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 1</span>
                      {metrics.totalJobs > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          <Check size={12} /> Done
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-subtle)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          Next Step
                        </span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>Create a Job Opening</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Define role requirements, skills, and compensation to allocate an atomic JOB-XXXX code.
                    </p>
                  </div>
                  <div>
                    <Link to="/jobs" className={metrics.totalJobs > 0 ? 'button-secondary' : 'button-primary'} style={{ width: '100%', justifyContent: 'center' }}>
                      <BriefcaseBusiness size={14} /> {metrics.totalJobs > 0 ? 'View Jobs' : 'Create Job Opening'}
                    </Link>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={\`roadmap-step-card\${metrics.publishedJobs > 0 ? ' roadmap-step-complete' : metrics.totalJobs > 0 ? ' roadmap-step-current' : ''}\`}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 2</span>
                      {metrics.publishedJobs > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          <Check size={12} /> Done
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>Pending Step 1</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>Publish an Opening</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Set status to Published so candidates can view and apply to your vacancies online.
                    </p>
                  </div>
                  <div>
                    <Link to="/jobs" className="button-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                      <ArrowRight size={14} /> {metrics.publishedJobs > 0 ? 'Manage Vacancies' : 'Publish from Jobs'}
                    </Link>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={\`roadmap-step-card\${metrics.totalApplications > 0 ? ' roadmap-step-complete' : metrics.publishedJobs > 0 ? ' roadmap-step-current' : ''}\`}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step 3</span>
                      {metrics.totalApplications > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                          <Check size={12} /> Done
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>Awaiting Candidates</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>Receive Inbound Applications</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                      Applications from your career page or email are matched automatically to vacancies.
                    </p>
                  </div>
                  <div>
                    <Link to="/unmatched" className="button-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                      <Inbox size={14} /> Review Inbound Portal
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4 Executive KPI Stat Cards */}
          <section className="dashboard-stats" aria-label="Recruitment executive metrics">
            <StatCard
              label="Active Vacancies"
              value={metrics.publishedJobs}
              description={\`\${metrics.totalJobs} total jobs created\`}
              icon={<BriefcaseBusiness size={18} />}
              tone="primary"
              badge={metrics.publishedJobs > 0 ? \`\${metrics.publishedJobs} Published\` : '0 Active'}
              to="/jobs"
            />
            <StatCard
              label="Talent Pool"
              value={metrics.totalCandidates}
              description="Unique candidates across vacancies"
              icon={<Users size={18} />}
              tone="violet"
              badge={metrics.totalCandidates > 0 ? \`\${metrics.totalCandidates} Sourced\` : '0 Candidates'}
              to="/talent-pool"
            />
            <StatCard
              label="Active Pipeline"
              value={metrics.totalApplications}
              description="Candidates across all stages"
              icon={<FileText size={18} />}
              tone="emerald"
              badge={metrics.totalApplications > 0 ? \`\${metrics.totalApplications} In Review\` : 'Ready'}
              to="/jobs"
            />
            <StatCard
              label="Recent Inbound"
              value={metrics.recentApplicationsCount}
              description="New applications in last 7 days"
              icon={<Zap size={18} />}
              tone="amber"
              badge="Autonomous IMAP"
              to="/unmatched"
            />
          </section>

          {/* Application Pipeline Funnel */}
          <section className="dashboard-panel pipeline-panel" aria-labelledby="pipeline-title">
            <div className="panel-heading">
              <div>
                <h2 id="pipeline-title">Application Pipeline</h2>
                <p>{metrics.totalApplications.toLocaleString()} applications across all stages</p>
              </div>
              <Link className="panel-heading-link" to="/jobs">
                Manage Vacancies <ArrowRight size={14} />
              </Link>
            </div>
            {metrics.totalApplications === 0 ? (
              <div className="pipeline-funnel-guide">
                <div className="funnel-steps-track" aria-label="Recruitment Stages">
                  {STAGES.slice(0, 6).map((stage, idx) => (
                    <div key={stage.value} className="funnel-step-node">
                      <div className="funnel-step-badge">
                        <span className={\`stage-tone-dot tone-\${stage.tone}\`} />
                        <span className="funnel-step-num">0{idx + 1}</span>
                      </div>
                      <strong className="funnel-step-label">{stage.label}</strong>
                      <span className="funnel-step-count">0 active</span>
                    </div>
                  ))}
                </div>

                <div className="pipeline-empty-guide-content">
                  <div className="guide-icon-banner">
                    <Activity size={20} className="guide-icon" />
                  </div>
                  <div className="guide-text">
                    <h3>Your Automated Pipeline is Ready</h3>
                    <p>
                      When candidates apply via your public career page or email their resumes with atomic <code>JOB-XXXX</code> codes, HiredeskHR parses attachments and automatically advances candidates through your screening stages.
                    </p>
                  </div>
                  <div className="guide-action">
                    <Link to="/jobs" className="button-primary">
                      <BriefcaseBusiness size={14} /> Post First Vacancy to Open Pipeline
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="pipeline-segmented-bar"
                  role="img"
                  aria-label={\`Applications by stage: \${STAGES.map(({ value, label }) => \`\${label}, \${getStageCount(metrics.stageCounts, value)}\`).join('; ')}\`}
                >
                  {STAGES.map(({ value, tone }) => {
                    const count = getStageCount(metrics.stageCounts, value);
                    const percentage = (count / metrics.totalApplications) * 100;
                    return <span key={value} className={\`pipeline-segment tone-\${tone}\`} style={{ width: \`\${percentage}%\` }} />;
                  })}
                </div>
                <ul className="pipeline-stage-list">
                  {STAGES.map(({ value, label, tone }) => (
                    <li key={value} className="pipeline-stage-item">
                      <span className={\`stage-tone-dot tone-\${tone}\`} aria-hidden="true" />
                      <span className="pipeline-stage-label">{label}</span>
                      <strong>{getStageCount(metrics.stageCounts, value).toLocaleString()}</strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Agency Recruitment Toolkit */}
          <section className="agency-toolkit-section" aria-label="Agency capabilities">
            <div className="toolkit-grid">
              <div className="toolkit-card">
                <div className="toolkit-card-icon tone-primary">
                  <Share2 size={18} />
                </div>
                <div className="toolkit-card-body">
                  <h4>Public Career Portal</h4>
                  <p>Distribute your agency's branded career board for public candidate submissions.</p>
                  <div className="toolkit-card-action">
                    <button type="button" className="inline-action-btn" onClick={handleCopyCareerLink}>
                      <Copy size={13} /> Copy <code>/career/{orgSlug}</code>
                    </button>
                  </div>
                </div>
              </div>

              <div className="toolkit-card">
                <div className="toolkit-card-icon tone-emerald">
                  <MailCheck size={18} />
                </div>
                <div className="toolkit-card-body">
                  <h4>Deterministic Matching</h4>
                  <p>Inbound emails with <code>JOB-XXXX</code> in the subject route straight to the right vacancy.</p>
                  <div className="toolkit-card-action">
                    <Link to="/unmatched" className="inline-action-btn">
                      <Inbox size={13} /> View Inbound Queue &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              <div className="toolkit-card">
                <div className="toolkit-card-icon tone-violet">
                  <ShieldCheck size={18} />
                </div>
                <div className="toolkit-card-body">
                  <h4>Client Review Portals</h4>
                  <p>Share candidate shortlists with clients using strict role-scoped reviewer access.</p>
                  <div className="toolkit-card-action">
                    <Link to="/talent-pool" className="inline-action-btn">
                      <Users size={13} /> Open Talent Pool &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="dashboard-panels-grid">
            <section className="dashboard-panel" aria-labelledby="deadlines-title">
              <div className="panel-heading">
                <div>
                  <h2 id="deadlines-title">Upcoming deadlines</h2>
                  <p>Published jobs closing in the next 14 days</p>
                </div>
                <Link className="panel-heading-link" to="/jobs">View jobs <ArrowRight size={14} /></Link>
              </div>
              {metrics.jobsApproachingDeadline.length === 0 ? (
                <EmptyState title="No upcoming deadlines" description="Jobs with a closing date in the next 14 days will appear here." />
              ) : (
                <ul className="deadline-list">
                  {metrics.jobsApproachingDeadline.map((job) => (
                    <li key={job.id}>
                      <Link to="/jobs" className="deadline-link">
                        <span className="deadline-job-main">
                          <span className="job-code">{job.jobCode}</span>
                          <strong>{job.title}</strong>
                          <span className="deadline-client">{job.clientName}</span>
                        </span>
                        <span className={\`deadline-count\${job.daysRemaining <= 3 ? ' deadline-count-urgent' : ''}\`}>
                          {job.daysRemaining === 0 ? 'Today' : \`\${job.daysRemaining} days\`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dashboard-panel" aria-labelledby="activity-title">
              <div className="panel-heading">
                <div>
                  <h2 id="activity-title">Recent activity</h2>
                  <p>Latest updates in your workspace</p>
                </div>
              </div>
              {metrics.recentActivity.length === 0 ? (
                <EmptyState title="No activity yet" description="Job and application updates will appear here." />
              ) : (
                <ol className="activity-list">
                  {metrics.recentActivity.map((activity) => (
                    <li key={activity.id}>
                      <span className="activity-marker" aria-hidden="true" />
                      <div className="activity-content">
                        <strong>{activityLabel(activity.action, activity.details)}</strong>
                        <span className="activity-meta">
                          {activity.details?.jobCode ? \`\${activity.details.jobCode} · \` : ''}
                          {activity.actor?.fullName ? \`By \${activity.actor.fullName} · \` : ''}
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
`;

content = content.substring(0, dashboardFnIndex) + newDashboardFn;
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched DashboardView.tsx');

