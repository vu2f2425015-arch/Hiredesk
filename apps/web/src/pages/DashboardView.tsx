import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Inbox,
  RefreshCw,
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
import { StatCard } from '../components/ui/StatCard';

const STAGES: Array<{ value: ApplicationStage; label: string; tone: string }> = [
  { value: ApplicationStage.APPLIED, label: 'Applied', tone: 'neutral' },
  { value: ApplicationStage.SCREENING, label: 'Screening', tone: 'info' },
  { value: ApplicationStage.SHORTLISTED, label: 'Shortlisted', tone: 'accent' },
  { value: ApplicationStage.INTERVIEW, label: 'Interview', tone: 'accent' },
  { value: ApplicationStage.AI_INTERVIEW, label: 'AI Interview', tone: 'accent' },
  { value: ApplicationStage.CLIENT_REVIEW, label: 'Client review', tone: 'warning' },
  { value: ApplicationStage.SELECTED, label: 'Selected', tone: 'success' },
  { value: ApplicationStage.HIRED, label: 'Hired', tone: 'success' },
  { value: ApplicationStage.REJECTED, label: 'Rejected', tone: 'danger' },
  { value: ApplicationStage.WITHDRAWN, label: 'Withdrawn', tone: 'neutral' },
];

function readCachedMetrics(cacheKey: string | null): DashboardMetrics | null {
  if (!cacheKey) return null;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    return cached ? (JSON.parse(cached) as DashboardMetrics) : null;
  } catch {
    return null;
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function activityLabel(action: string, details: { toStage?: string } | null | undefined): string {
  if (action === 'stage_transition') {
    return details?.toStage ? `Application moved to ${details.toStage}` : 'Application stage updated';
  }
  return action.replace(/_/g, ' ');
}

function getStageCount(stageCounts: Record<string, number> | undefined, stageValue: string): number {
  if (!stageCounts) return 0;
  if (typeof stageCounts[stageValue] === 'number') return stageCounts[stageValue];
  const lower = stageValue.toLowerCase();
  if (typeof stageCounts[lower] === 'number') return stageCounts[lower];
  const snake = lower.replace(/\s+/g, '_');
  if (typeof stageCounts[snake] === 'number') return stageCounts[snake];
  const matchedKey = Object.keys(stageCounts).find(
    (k) => k.toLowerCase() === lower || k.toLowerCase() === snake
  );
  return matchedKey ? stageCounts[matchedKey] : 0;
}

function getActivePipelineCount(stageCounts: Record<string, number> | undefined): number {
  return [
    ApplicationStage.APPLIED,
    ApplicationStage.SCREENING,
    ApplicationStage.SHORTLISTED,
    ApplicationStage.INTERVIEW,
    ApplicationStage.AI_INTERVIEW,
    ApplicationStage.CLIENT_REVIEW,
    ApplicationStage.SELECTED,
  ].reduce((total, stage) => total + getStageCount(stageCounts, stage), 0);
}

function PublicHome() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'inbound' | 'client'>('pipeline');

  return (
    <div className="public-home">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="hero-badge-dot" aria-hidden="true" />
          <ShieldCheck size={14} className="hero-badge-icon" aria-hidden="true" />
          <span>Agency Recruitment System</span>
        </div>

        <h1 className="hero-title">
          The Modern Applicant Tracking System Built for{' '}
          <span className="hero-gradient-text">Recruitment Agencies</span>
        </h1>

        <p className="hero-description">
          Publish vacancies, collect applications, review candidate pipelines,
          and collaborate with clients in one agency workspace.
        </p>

        <div className="hero-actions">
          <Link className="button-primary hero-btn-lg" to="/register">
            Register your agency <ArrowRight size={17} />
          </Link>
          <Link className="button-secondary hero-btn-lg" to="/login">
            Sign in to workspace
          </Link>
          <Link className="hero-status-pill" to="/system-status">
            <Activity size={14} aria-hidden="true" /> View API status
          </Link>
        </div>

        <div className="hero-trust-strip">
          <span className="hero-trust-item"><Zap size={14} /> Agency-focused workflow</span>
          <span className="hero-trust-item"><ShieldCheck size={14} /> Role-scoped access</span>
          <span className="hero-trust-item"><MailCheck size={14} /> Inbound resume processing</span>
          <span className="hero-trust-item"><Activity size={14} /> Database-backed reports</span>
        </div>
      </section>

      {/* Product capabilities; performance and security claims are intentionally not fabricated. */}
      <section className="metrics-strip" aria-label="Recruitment workflow capabilities">
        <div className="metric-card">
          <div className="metric-value"><BriefcaseBusiness size={24} aria-hidden="true" /></div>
          <div className="metric-label">Vacancy job codes</div>
          <div className="metric-subtext">Give each opening a reference for applications and inbound resumes.</div>
        </div>
        <div className="metric-card">
          <div className="metric-value"><MailCheck size={24} aria-hidden="true" /></div>
          <div className="metric-label">Resume intake</div>
          <div className="metric-subtext">Collect resumes from the career page or a configured inbound mailbox.</div>
        </div>
        <div className="metric-card">
          <div className="metric-value"><Layers size={24} aria-hidden="true" /></div>
          <div className="metric-label">Application stages</div>
          <div className="metric-subtext">Track applications as recruiters review and progress candidates.</div>
        </div>
        <div className="metric-card">
          <div className="metric-value"><Users size={24} aria-hidden="true" /></div>
          <div className="metric-label">Client collaboration</div>
          <div className="metric-subtext">Share candidate reviews through role-scoped client access.</div>
        </div>
      </section>

      {/* Interactive Product Showcase Window */}
      <section className="product-showcase-section" aria-label="Illustrative product tour">
        <div className="section-header-center">
          <p className="section-eyebrow">Interactive Product Tour</p>
          <h2 className="section-heading">Designed for Speed, Precision, and Collaboration</h2>
          <p className="section-subtext">Explore the workflow using clearly labeled sample content.</p>
        </div>

        <div className="showcase-window">
          {/* Window Chrome */}
          <div className="showcase-window-header">
            <div className="showcase-window-controls" aria-hidden="true">
              <span className="window-dot dot-red" />
              <span className="window-dot dot-yellow" />
              <span className="window-dot dot-green" />
            </div>
            <div className="showcase-window-address">
              <span>https://hiredesk.agency/workspace/active-pipeline</span>
            </div>
            <div className="showcase-window-status sample-workspace-label">
              Sample workspace · illustrative data
            </div>
          </div>

          {/* Interactive Showcase Tabs */}
          <div className="showcase-tab-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pipeline'}
              className={`showcase-tab-button ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              <Layers size={15} /> Pipeline Kanban
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'inbound'}
              className={`showcase-tab-button ${activeTab === 'inbound' ? 'active' : ''}`}
              onClick={() => setActiveTab('inbound')}
            >
              <MailCheck size={15} /> Smart Inbound Parser
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'client'}
              className={`showcase-tab-button ${activeTab === 'client' ? 'active' : ''}`}
              onClick={() => setActiveTab('client')}
            >
              <Users size={15} /> Client Review Portal
            </button>
          </div>

          {/* Tab 1: Live Pipeline Kanban */}
          {activeTab === 'pipeline' && (
            <div className="showcase-content">
              <div className="mock-kanban-board">
                <div className="mock-kanban-col">
                  <div className="mock-col-header">
                    <span className="mock-col-title">Applied</span>
                    <span className="mock-col-count">12</span>
                  </div>
                  <div className="mock-candidate-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1042</span>
                      <span className="mock-fit-pill">New application</span>
                    </div>
                    <div className="mock-cand-name">Sample candidate A</div>
                    <div className="mock-cand-role">Senior Full-Stack Engineer</div>
                    <div className="mock-card-meta">
                      <span>2h ago</span>
                      <span className="mock-tag">React · Node · PG</span>
                    </div>
                  </div>
                  <div className="mock-candidate-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1039</span>
                      <span className="mock-fit-pill">Resume received</span>
                    </div>
                    <div className="mock-cand-name">Sample candidate B</div>
                    <div className="mock-cand-role">Cloud Infrastructure Lead</div>
                    <div className="mock-card-meta">
                      <span>4h ago</span>
                      <span className="mock-tag">AWS · Kubernetes</span>
                    </div>
                  </div>
                </div>

                <div className="mock-kanban-col">
                  <div className="mock-col-header">
                    <span className="mock-col-title">Screening</span>
                    <span className="mock-col-count">6</span>
                  </div>
                  <div className="mock-candidate-card active-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1042</span>
                      <span className="mock-fit-pill pill-accent">Shortlisted</span>
                    </div>
                    <div className="mock-cand-name">Sample candidate C</div>
                    <div className="mock-cand-role">Staff Frontend Architect</div>
                    <div className="mock-card-meta">
                      <span>Recruiter: Alex M.</span>
                      <span className="mock-tag">Application reviewed</span>
                    </div>
                  </div>
                </div>

                <div className="mock-kanban-col">
                  <div className="mock-col-header">
                    <span className="mock-col-title">Client Review</span>
                    <span className="mock-col-count">4</span>
                  </div>
                  <div className="mock-candidate-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1038</span>
                      <span className="mock-fit-pill pill-warning">Awaiting Client</span>
                    </div>
                    <div className="mock-cand-name">Sample candidate D</div>
                    <div className="mock-cand-role">Senior Product Designer</div>
                    <div className="mock-card-meta">
                      <span>Shared with Acme Corp</span>
                    </div>
                  </div>
                </div>

                <div className="mock-kanban-col">
                  <div className="mock-col-header">
                    <span className="mock-col-title">Interview</span>
                    <span className="mock-col-count">3</span>
                  </div>
                  <div className="mock-candidate-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1035</span>
                      <span className="mock-fit-pill pill-success">Interview stage</span>
                    </div>
                    <div className="mock-cand-name">Sample candidate E</div>
                    <div className="mock-cand-role">Principal Engineer</div>
                    <div className="mock-card-meta">
                      <span>Example interview</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Smart Inbound & Job Code Matching */}
          {activeTab === 'inbound' && (
            <div className="showcase-content">
              <div className="mock-inbound-view">
                <div className="mock-inbound-card">
                  <div className="mock-inbound-header">
                    <div className="inbound-from-chip">
                      <MailCheck size={16} /> From: candidate@example.com
                    </div>
                    <span className="mock-fit-pill pill-success">Matched by job code · example</span>
                  </div>
                  <div className="mock-inbound-body">
                    <strong>Subject: Application for Senior Full-Stack Engineer (JOB-1042)</strong>
                    <p className="mock-inbound-text">
                      "Hello, I am applying for the example vacancy. Please see my attached resume."
                    </p>
                    <div className="mock-attachment-pill">
                      <FileText size={15} /> alex_turner_resume.pdf <span className="mock-filesize">142 KB</span>
                    </div>
                  </div>
                  <div className="mock-inbound-footer">
                    <span className="inbound-rule-tag">Example inbound message · sample data</span>
                    <span className="button-primary mock-btn-sm">Move to Screening →</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Client Review Portal */}
          {activeTab === 'client' && (
            <div className="showcase-content">
              <div className="mock-client-portal">
                <div className="mock-client-header">
                  <div className="mock-client-brand">
                    <Building2 size={18} /> Sample client company
                  </div>
                  <span className="mock-client-role-badge">Client Reviewer Portal</span>
                </div>
                <div className="mock-client-candidate-dossier">
                  <div className="dossier-info">
                    <h3>Sample candidate A</h3>
                    <p className="dossier-role">Candidate for: Senior Full-Stack Engineer (JOB-1042)</p>
                    <p className="dossier-recruiter-notes">
                      <strong>Example recruiter note:</strong> Sample content for demonstrating the client review layout.
                    </p>
                  </div>
                  <div className="dossier-actions">
                    <button type="button" className="button-primary mock-btn-sm" disabled title="Illustrative control in the product tour"><Check size={14} /> Request Interview</button>
                    <button type="button" className="button-secondary mock-btn-sm" disabled title="Illustrative control in the product tour">Review Portfolio</button>
                    <button type="button" className="button-secondary mock-btn-sm text-danger" disabled title="Illustrative control in the product tour">Decline Candidate</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="features-section" aria-label="Platform capabilities">
        <div className="section-header-center">
          <p className="section-eyebrow">Platform capabilities</p>
          <h2 className="section-heading">Built specifically for high-volume recruitment</h2>
          <p className="section-subtext">Tools for organizing vacancies, applications, candidate records, and client reviews.</p>
        </div>

        <div className="features-grid">
          <article className="feature-bento-card">
            <div className="feature-icon-box"><Zap size={20} /></div>
            <h3>Vacancy job codes</h3>
            <p>Each vacancy receives a job code recruiters can use to associate incoming applications with the right opening.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><MailCheck size={20} /></div>
            <h3>Inbound resume processing</h3>
            <p>A configured mailbox can be polled for application emails and resume attachments. Job codes help route applications to an opening.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><ShieldCheck size={20} /></div>
            <h3>Role-scoped workspace access</h3>
            <p>Workspace roles determine which recruitment and client review areas a signed-in user can access.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><Users size={20} /></div>
            <h3>Candidate folders</h3>
            <p>Organize candidate records into folders and associate candidates with relevant job openings.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><FileText size={20} /></div>
            <h3>Recruitment activity</h3>
            <p>Review workspace activity and application stage changes alongside vacancy and candidate information.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><Activity size={20} /></div>
            <h3>API health check</h3>
            <p>Check whether the API service responds. Database and mail-worker health are not currently reported on this page.</p>
          </article>
        </div>
      </section>

      {/* Visual 3-Step Agency Workflow */}
      <section className="workflow-section" aria-label="How it works">
        <div className="section-header-center">
          <p className="section-eyebrow">Workflow</p>
          <h2 className="section-heading">From Vacancy to Placement in Three Clean Steps</h2>
          <p className="section-subtext">How agency recruiters and clients move faster together on HiredeskHR.</p>
        </div>

        <div className="workflow-steps-grid">
          <div className="workflow-step-card">
            <div className="step-number-badge">01</div>
            <h3>Publish with Job Code</h3>
            <p>Create vacancies and get an atomic <code>JOB-XXXX</code> code. Share it across job boards, LinkedIn, and email campaigns.</p>
          </div>
          <div className="workflow-step-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
          <div className="workflow-step-card">
            <div className="step-number-badge">02</div>
            <h3>Route and review applications</h3>
            <p>Applications with a matching job code can be associated with a vacancy, then advanced through recruiter-managed stages.</p>
          </div>
          <div className="workflow-step-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
          <div className="workflow-step-card">
            <div className="step-number-badge">03</div>
            <h3>Collaborate & Close</h3>
            <p>Share shortlisted candidates for client review. Recruiters can schedule interviews and add meeting details in the workspace.</p>
          </div>
        </div>
      </section>

      {/* Ready-to-Launch CTA Banner */}
      <section className="cta-banner" aria-label="Get started">
        <div className="cta-banner-content">
          <span className="hero-badge-dot" aria-hidden="true" />
          <h2>Bring your recruitment workflow together</h2>
          <p>Manage vacancies, applications, candidate records, and client reviews in one agency workspace.</p>
          <div className="cta-banner-actions">
            <Link className="button-primary hero-btn-lg" to="/register">
              Register your agency <ArrowRight size={17} />
            </Link>
            <Link className="button-secondary hero-btn-lg" to="/login">
              Sign in to workspace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" role="status" aria-live="polite" aria-label="Loading dashboard">
      <div className="skeleton-surface skeleton-header">
        <span className="skeleton-line skeleton-line-short" />
        <span className="skeleton-line skeleton-line-long" />
      </div>
      <div className="dashboard-stats">
        {[0, 1].map((item) => <div className="skeleton-surface skeleton-stat" key={item}><span className="skeleton-line skeleton-line-short" /><span className="skeleton-line skeleton-line-value" /></div>)}
      </div>
      <div className="skeleton-surface skeleton-panel"><span className="skeleton-line skeleton-line-short" /><span className="skeleton-line skeleton-line-long" /></div>
    </div>
  );
}

export function DashboardView() {
  const { session, profile } = useAuth();
  const { showToast, success: toastSuccess } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const token = session?.access_token;
  const cacheKey = profile?.organizationId ? `hd_dashboard_cache_${profile.organizationId}` : null;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(() => readCachedMetrics(cacheKey));
  const [loading, setLoading] = useState(!metrics);
  const [error, setError] = useState<string | null>(null);

  const orgSlug = profile?.organizationSlug || (profile?.organizationName || 'agency')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const careerUrl = `${window.location.origin}/career/${orgSlug}`;

  const handleCopyCareerLink = () => {
    navigator.clipboard.writeText(careerUrl).then(() => {
      setCopiedLink(true);
      toastSuccess('Career Portal Link Copied!', `Share ${careerUrl} with candidates to receive applications.`);
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
      {/* Executive Command Header */}
      <section className="dashboard-hero-card" aria-label="Workspace overview">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-eyebrow">
            <span className="hero-org-tag">
              <Building2 size={13} /> {profile.organizationName || 'Agency Workspace'}
            </span>
            <span className="hero-status-pill">
              <span className="pulse-dot" /> Live Pipeline
            </span>
          </div>

          <h1 className="dashboard-hero-title">
            Recruitment Overview
          </h1>

          <p className="dashboard-hero-sub">
            Welcome back, <strong>{profile.fullName || profile.firstName || 'Recruiter'}</strong>. Manage vacancies, candidate pipelines, and client submissions for <strong>{profile.organizationName || 'your agency'}</strong>.
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
              href={`/career/${orgSlug}`}
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
                    Workspace Setup
                  </div>
                  <h2 id="onboarding-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Get Started with Your Workspace</h2>
                  <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Follow these key steps to configure your hiring pipeline and begin accepting applicants.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0))} of 3 Completed ({Math.round((((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)) / 3) * 100)}%)
                  </span>
                  <div className="roadmap-progress-track" role="progressbar" aria-label="Workspace setup progress" aria-valuemin={0} aria-valuemax={3} aria-valuenow={(metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)}>
                    <div className="roadmap-progress-value" style={{ width: `${Math.round((((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)) / 3) * 100)}%` }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Step 1 */}
                <div className={`roadmap-step-card${metrics.totalJobs === 0 ? ' roadmap-step-current' : ' roadmap-step-complete'}`}>
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
                      Specify job title, required skills, experience level, and compensation.
                    </p>
                  </div>
                  <div>
                    <Link to="/jobs" className={metrics.totalJobs > 0 ? 'button-secondary' : 'button-primary'} style={{ width: '100%', justifyContent: 'center' }}>
                      <BriefcaseBusiness size={14} /> {metrics.totalJobs > 0 ? 'View Jobs' : 'Create Job Opening'}
                    </Link>
                  </div>
                </div>

                {/* Step 2 */}
                <div className={`roadmap-step-card${metrics.publishedJobs > 0 ? ' roadmap-step-complete' : metrics.totalJobs > 0 ? ' roadmap-step-current' : ''}`}>
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
                      Set status to Published so candidates can browse and apply on your career portal.
                    </p>
                  </div>
                  <div>
                    <Link to="/jobs" className="button-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                      <ArrowRight size={14} /> {metrics.publishedJobs > 0 ? 'Manage Vacancies' : 'Publish from Jobs'}
                    </Link>
                  </div>
                </div>

                {/* Step 3 */}
                <div className={`roadmap-step-card${metrics.totalApplications > 0 ? ' roadmap-step-complete' : metrics.publishedJobs > 0 ? ' roadmap-step-current' : ''}`}>
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
                      Review incoming resumes, evaluate candidate fit, and advance applicants through stages.
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
              description={`${metrics.totalJobs} total jobs created`}
              icon={<BriefcaseBusiness size={18} />}
              tone="primary"
              badge={metrics.publishedJobs > 0 ? `${metrics.publishedJobs} Published` : '0 Active'}
              to="/jobs"
            />
            <StatCard
              label="Candidate Profiles"
              value={metrics.totalCandidates}
              description="Candidate records in your agency workspace"
              icon={<Users size={18} />}
              tone="violet"
              badge={metrics.totalCandidates > 0 ? 'In workspace' : 'No profiles yet'}
              to="/talent-pool"
            />
            <StatCard
              label="Active Pipeline"
              value={getActivePipelineCount(metrics.stageCounts)}
              description="Applications not yet hired or closed"
              icon={<FileText size={18} />}
              tone="emerald"
              badge={getActivePipelineCount(metrics.stageCounts) > 0 ? `${getActivePipelineCount(metrics.stageCounts)} active` : 'No active applications'}
              to="/jobs"
            />
            <StatCard
              label="Recent Inbound"
              value={metrics.recentApplicationsCount}
              description="New applications in last 7 days"
              icon={<Zap size={18} />}
              tone="amber"
              badge="Past 7 days"
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
                        <span className={`stage-tone-dot tone-${stage.tone}`} />
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
                  aria-label={`Applications by stage: ${STAGES.map(({ value, label }) => `${label}, ${getStageCount(metrics.stageCounts, value)}`).join('; ')}`}
                >
                  {STAGES.map(({ value, tone }) => {
                    const count = getStageCount(metrics.stageCounts, value);
                    const percentage = (count / metrics.totalApplications) * 100;
                    return <span key={value} className={`pipeline-segment tone-${tone}`} style={{ width: `${percentage}%` }} />;
                  })}
                </div>
                <ul className="pipeline-stage-list">
                  {STAGES.map(({ value, label, tone }) => (
                    <li key={value} className="pipeline-stage-item">
                      <span className={`stage-tone-dot tone-${tone}`} aria-hidden="true" />
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
                  <h4>Automated Job Routing</h4>
                  <p>Inbound applications with <code>JOB-XXXX</code> codes route directly to the matching vacancy pipeline.</p>
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
                        <span className={`deadline-count${job.daysRemaining <= 3 ? ' deadline-count-urgent' : ''}`}>
                          {job.daysRemaining === 0 ? 'Today' : `${job.daysRemaining} days`}
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
                          {activity.details?.jobCode ? `${activity.details.jobCode} · ` : ''}
                          {activity.actor?.fullName ? `By ${activity.actor.fullName} · ` : ''}
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
