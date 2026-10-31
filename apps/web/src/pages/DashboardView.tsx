import { useCallback, useEffect, useState } from 'react';
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
import { PageHeader } from '../components/shell/PageHeader';

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

function PublicHome() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'inbound' | 'client'>('pipeline');

  return (
    <div className="public-home">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-badge">
          <span className="hero-badge-dot" aria-hidden="true" />
          <Sparkles size={14} className="hero-badge-icon" aria-hidden="true" />
          <span>Enterprise-Grade Agency ATS & Workflow Automation</span>
        </div>

        <h1 className="hero-title">
          The High-Performance ATS Built for{' '}
          <span className="hero-gradient-text">Modern Recruitment Agencies</span>
        </h1>

        <p className="hero-description">
          Streamline job distribution, automate inbound resume matching with deterministic job codes,
          and deliver transparent, role-scoped client reviews — all in one unified workspace.
        </p>

        <div className="hero-actions">
          <Link className="button-primary hero-btn-lg" to="/register">
            Register your agency <ArrowRight size={17} />
          </Link>
          <Link className="button-secondary hero-btn-lg" to="/login">
            Sign in to workspace
          </Link>
          <Link className="hero-status-pill" to="/system-status">
            <span className="status-live-dot" /> All systems operational
          </Link>
        </div>

        <div className="hero-trust-strip">
          <span className="hero-trust-item"><Zap size={14} /> Instant Workspace Setup</span>
          <span className="hero-trust-item"><ShieldCheck size={14} /> Multi-Tenant RBAC</span>
          <span className="hero-trust-item"><MailCheck size={14} /> Autonomous IMAP Parsing</span>
          <span className="hero-trust-item"><Activity size={14} /> Real-Time Analytics</span>
        </div>
      </section>

      {/* Metrics & Performance Strip */}
      <section className="metrics-strip" aria-label="Key platform metrics">
        <div className="metric-card">
          <div className="metric-value">10<span className="metric-accent">x</span></div>
          <div className="metric-label">Faster Ingestion</div>
          <div className="metric-subtext">Automated IMAP parsing & resume attachment extraction</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">100<span className="metric-accent">%</span></div>
          <div className="metric-label">Tenant Isolation</div>
          <div className="metric-subtext">Organization-scoped data partitioning & strict RBAC</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">&lt;200<span className="metric-accent">ms</span></div>
          <div className="metric-label">Query Latency</div>
          <div className="metric-subtext">PostgreSQL sequence generation & connection pooling</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">99.9<span className="metric-accent">%</span></div>
          <div className="metric-label">Operational SLA</div>
          <div className="metric-subtext">High-availability cloud persistence & resilient APIs</div>
        </div>
      </section>

      {/* Interactive Product Showcase Window */}
      <section className="product-showcase-section" aria-label="Live product preview">
        <div className="section-header-center">
          <p className="section-eyebrow">Interactive Product Tour</p>
          <h2 className="section-heading">Designed for Speed, Precision, and Collaboration</h2>
          <p className="section-subtext">Explore how HiredeskHR powers the end-to-end recruitment lifecycle.</p>
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
            <div className="showcase-window-status">
              <span className="status-live-dot" /> Live Workspace
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
                      <span className="mock-fit-pill">96% Match</span>
                    </div>
                    <div className="mock-cand-name">Elena Rostova</div>
                    <div className="mock-cand-role">Senior Full-Stack Engineer</div>
                    <div className="mock-card-meta">
                      <span>2h ago</span>
                      <span className="mock-tag">React · Node · PG</span>
                    </div>
                  </div>
                  <div className="mock-candidate-card">
                    <div className="mock-card-top">
                      <span className="mock-job-code">JOB-1039</span>
                      <span className="mock-fit-pill">88% Match</span>
                    </div>
                    <div className="mock-cand-name">Marcus Vance</div>
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
                    <div className="mock-cand-name">Sarah Jenkins</div>
                    <div className="mock-cand-role">Staff Frontend Architect</div>
                    <div className="mock-card-meta">
                      <span>Recruiter: Alex M.</span>
                      <span className="mock-tag">Resume Verified</span>
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
                    <div className="mock-cand-name">David Chen</div>
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
                      <span className="mock-fit-pill pill-success">Confirmed</span>
                    </div>
                    <div className="mock-cand-name">Priya Patel</div>
                    <div className="mock-cand-role">Principal Engineer</div>
                    <div className="mock-card-meta">
                      <span>Tomorrow, 2:00 PM</span>
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
                      <MailCheck size={16} /> From: alex.turner@developer.io
                    </div>
                    <span className="mock-fit-pill pill-success">✓ Auto-Matched to JOB-1042</span>
                  </div>
                  <div className="mock-inbound-body">
                    <strong>Subject: Application for Senior Full-Stack Engineer (JOB-1042)</strong>
                    <p className="mock-inbound-text">
                      "Hi Hiring Team, please find attached my resume for the Senior Full-Stack vacancy (Ref: JOB-1042).
                      I have 8+ years experience in TypeScript, React, and cloud native architectures..."
                    </p>
                    <div className="mock-attachment-pill">
                      <FileText size={15} /> alex_turner_resume.pdf <span className="mock-filesize">142 KB</span>
                    </div>
                  </div>
                  <div className="mock-inbound-footer">
                    <span className="inbound-rule-tag">Gmail IMAP Poller: Received & Parsed in 420ms</span>
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
                    <Building2 size={18} /> Acme Global Technologies
                  </div>
                  <span className="mock-client-role-badge">Client Reviewer Portal</span>
                </div>
                <div className="mock-client-candidate-dossier">
                  <div className="dossier-info">
                    <h3>Elena Rostova</h3>
                    <p className="dossier-role">Candidate for: Senior Full-Stack Engineer (JOB-1042)</p>
                    <p className="dossier-recruiter-notes">
                      <strong>Recruiter Note:</strong> Excellent culture fit, strong system design background, passed technical pre-screen with 96% score. Ready for final interview.
                    </p>
                  </div>
                  <div className="dossier-actions">
                    <button type="button" className="button-primary mock-btn-sm"><Check size={14} /> Request Interview</button>
                    <button type="button" className="button-secondary mock-btn-sm">Review Portfolio</button>
                    <button type="button" className="button-secondary mock-btn-sm text-danger">Decline Candidate</button>
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
          <p className="section-eyebrow">Enterprise Capabilities</p>
          <h2 className="section-heading">Built specifically for high-volume recruitment</h2>
          <p className="section-subtext">Every feature is designed to reduce manual effort, eliminate misallocated resumes, and boost placement speed.</p>
        </div>

        <div className="features-grid">
          <article className="feature-bento-card">
            <div className="feature-icon-box"><Zap size={20} /></div>
            <h3>Atomic Code Sequences</h3>
            <p>PostgreSQL sequences guarantee deterministic, collision-free <code>JOB-XXXX</code> and <code>CAND-XXXX</code> codes across concurrent recruiters.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><MailCheck size={20} /></div>
            <h3>Autonomous IMAP Parsing</h3>
            <p>Integrated background workers continuously poll Gmail mailboxes, extract MIME resume attachments, and automatically associate candidates with the right opening.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><ShieldCheck size={20} /></div>
            <h3>Strict Multi-Tenant RBAC</h3>
            <p>Role-scoped isolation protects sensitive data across Super Admins, Branch Managers, Recruiters, and external Client Reviewers with zero leakage.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><Users size={20} /></div>
            <h3>Dynamic Talent Pool Folders</h3>
            <p>Curate candidate lists across departments, maintain a centralized talent bench, and instantly redeploy silver medalists to new vacancies.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><FileText size={20} /></div>
            <h3>Comprehensive Audit Trail</h3>
            <p>Every pipeline transition, client comment, interview invite, and stage change is immutably logged with actor attribution and timestamps.</p>
          </article>

          <article className="feature-bento-card">
            <div className="feature-icon-box"><Activity size={20} /></div>
            <h3>Live Health Diagnostics</h3>
            <p>Real-time visibility into database connection pool status, worker heartbeats, and API response latencies ensures 99.9% uptime confidence.</p>
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
            <h3>Automated Matching & Staging</h3>
            <p>Inbound emails and web applications are automatically parsed, resumes stored securely, and staged in your live Kanban pipeline.</p>
          </div>
          <div className="workflow-step-arrow" aria-hidden="true"><ArrowRight size={22} /></div>
          <div className="workflow-step-card">
            <div className="step-number-badge">03</div>
            <h3>Collaborate & Close</h3>
            <p>Invite clients to review shortlisted profiles in their dedicated portal. Collect approvals and schedule interviews in one click.</p>
          </div>
        </div>
      </section>

      {/* Ready-to-Launch CTA Banner */}
      <section className="cta-banner" aria-label="Get started">
        <div className="cta-banner-content">
          <span className="hero-badge-dot" aria-hidden="true" />
          <h2>Ready to Modernize Your Recruitment Agency?</h2>
          <p>Join leading recruitment teams who hire faster, manage pipelines cleaner, and keep clients thrilled.</p>
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
  const token = session?.access_token;
  const cacheKey = profile?.organizationId ? `hd_dashboard_cache_${profile.organizationId}` : null;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(() => readCachedMetrics(cacheKey));
  const [loading, setLoading] = useState(!metrics);
  const [error, setError] = useState<string | null>(null);

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
      <PageHeader
        title="Dashboard"
        description={`Recruitment activity for ${profile.organizationName || 'your workspace'}.`}
        action={<Link className="button-primary" to="/jobs"><BriefcaseBusiness size={16} /> Post job</Link>}
        secondaryActions={(
          <div className="dashboard-quick-actions">
            <Link className="button-secondary" to="/unmatched"><Inbox size={15} /> Review inbound</Link>
            <Link className="button-secondary" to="/interviews"><CalendarDays size={15} /> Schedule interview</Link>
          </div>
        )}
      />

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
            <section className="onboarding-panel" aria-labelledby="onboarding-title" style={{ padding: '1.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
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
                  <div style={{ width: '140px', height: '6px', background: 'var(--border-default)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((((metrics.totalJobs > 0 ? 1 : 0) + (metrics.publishedJobs > 0 ? 1 : 0) + (metrics.totalApplications > 0 ? 1 : 0)) / 3) * 100)}%`, height: '100%', background: 'var(--primary)', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {/* Step 1 */}
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', background: metrics.totalJobs > 0 ? 'var(--bg-subtle)' : 'var(--bg-surface)', border: `1px solid ${metrics.totalJobs > 0 ? 'var(--border-default)' : 'var(--primary)'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
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
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', background: metrics.publishedJobs > 0 ? 'var(--bg-subtle)' : 'var(--bg-surface)', border: `1px solid ${metrics.publishedJobs > 0 ? 'var(--border-default)' : 'var(--border-default)'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
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
                <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-lg)', background: metrics.totalApplications > 0 ? 'var(--bg-subtle)' : 'var(--bg-surface)', border: `1px solid ${metrics.totalApplications > 0 ? 'var(--border-default)' : 'var(--border-default)'}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
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

          <section className="dashboard-stats" aria-label="Recruitment summary">
            <StatCard label="Active jobs" value={metrics.publishedJobs} description={`${metrics.totalJobs} total jobs`} to="/jobs" />
            <StatCard label="Candidates" value={metrics.totalCandidates} description="Unique candidates across vacancies" />
          </section>

          <section className="dashboard-panel pipeline-panel" aria-labelledby="pipeline-title">
            <div className="panel-heading">
              <div>
                <h2 id="pipeline-title">Application pipeline</h2>
                <p>{metrics.totalApplications.toLocaleString()} applications across all stages</p>
              </div>
            </div>
            {metrics.totalApplications === 0 ? (
              <EmptyState title="No applications yet" description="Applications will appear here as candidates apply to your published jobs." />
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
