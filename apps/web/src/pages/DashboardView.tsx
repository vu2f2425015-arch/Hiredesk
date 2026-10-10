import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Calendar,
  Layers,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { DashboardMetrics, fetchDashboardAnalytics } from '../lib/api';
import { ApplicationStage } from '@hiredesk/shared';

export function DashboardView() {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardAnalytics(token);
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadMetrics();
    } else {
      setLoading(false);
    }
  }, [token, loadMetrics]);

  if (!profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
            <Sparkles size={18} /> Agency Recruitment ATS Platform
          </div>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.75rem', lineHeight: 1.2 }}>
            Welcome to <span style={{ color: 'var(--primary)' }}>HiredeskHR</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '780px', marginBottom: '1.75rem' }}>
            High-velocity ATS built for multi-client recruitment agencies. Concurrency-safe Job Codes,
            shared mailbox resume ingestion, and strict tenant isolation.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link to="/login" className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', fontSize: '0.95rem' }}>
              Sign In to Recruiter Workspace <ArrowRight size={16} />
            </Link>
            <Link to="/jobs" className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.95rem' }}>
              Explore Vacancies
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Atomic Global Job Codes</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Unambiguous sequence-based codes (<code>JOB-1001</code>) bridge incoming emails and public job applications directly to the correct client vacancy.
            </p>
          </div>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Multi-Tenant Security</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Agency Organizations &rarr; Clients &rarr; Jobs &rarr; Candidates. Internal recruiter notes are strictly invisible to clients.
            </p>
          </div>
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Zero Fake Data</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              All pipeline stages, candidate counts, and activities are derived straight from PostgreSQL database transactions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Welcome & Context Banner */}
      <div
        className="glass-card"
        style={{
          borderLeft: '4px solid var(--primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1.5rem 2rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700, letterSpacing: '0.05em' }}>
              Recruiter Command Center
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                color: 'var(--accent-cyan)',
                background: 'rgba(6, 182, 212, 0.1)',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              {profile.role}
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>
            Welcome back, {profile.firstName || profile.fullName || 'Recruiter'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            {profile.organizationName || 'Platform Super-Admin'} &bull; Database-backed recruitment pipeline & metrics
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={loadMetrics} title="Refresh metrics">
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
          <Link to="/jobs" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Briefcase size={16} /> View Vacancies
          </Link>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
          <p>Computing real-time analytics from database...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '1.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button className="btn btn-secondary" onClick={loadMetrics}>
            Retry
          </button>
        </div>
      ) : metrics ? (
        <>
          {/* KPI Stat Cards (Database Computed) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {/* Active Jobs */}
            <div
              className="glass-card"
              onClick={() => navigate('/jobs')}
              style={{ cursor: 'pointer', padding: '1.25rem', transition: 'transform 0.15s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>ACTIVE JOBS</span>
                <Briefcase size={16} color="var(--primary)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
                {metrics.publishedJobs}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                {metrics.totalJobs} total ({metrics.draftJobs} drafts, {metrics.closedJobs} closed)
              </div>
            </div>

            {/* Total Unique Candidates */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>TOTAL CANDIDATES</span>
                <Users size={16} color="var(--accent-cyan)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
                {metrics.totalCandidates}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Unique across all vacancies
              </div>
            </div>

            {/* Total Applications */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>APPLICATIONS</span>
                <FileText size={16} color="var(--accent-violet)" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
                {metrics.totalApplications}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                +{metrics.recentApplicationsCount} in last 7 days
              </div>
            </div>

            {/* Shortlisted */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>SHORTLISTED</span>
                <TrendingUp size={16} color="#6366f1" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
                {metrics.stageCounts[ApplicationStage.SHORTLISTED] || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Ready for interview
              </div>
            </div>

            {/* In Interview */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>IN INTERVIEW</span>
                <Calendar size={16} color="#8b5cf6" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-main)' }}>
                {metrics.stageCounts[ApplicationStage.INTERVIEW] || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Active evaluation
              </div>
            </div>

            {/* Hired */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>
                <span>HIRED</span>
                <UserCheck size={16} color="#10b981" />
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--success)' }}>
                {metrics.stageCounts[ApplicationStage.HIRED] || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                Successful placements
              </div>
            </div>
          </div>

          {/* Two-Column Layout: Pipeline Stage Breakdown & Approaching Deadlines / Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem' }}>
            {/* Left Column: Stage Progression & Deadlines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Pipeline Stage Distribution */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={18} color="var(--primary)" /> Application Stage Distribution
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {[
                    { stage: ApplicationStage.APPLIED, label: 'Applied', count: metrics.stageCounts[ApplicationStage.APPLIED] || 0, color: 'var(--text-muted)' },
                    { stage: ApplicationStage.SCREENING, label: 'Screening', count: metrics.stageCounts[ApplicationStage.SCREENING] || 0, color: 'var(--accent-cyan)' },
                    { stage: ApplicationStage.SHORTLISTED, label: 'Shortlisted', count: metrics.stageCounts[ApplicationStage.SHORTLISTED] || 0, color: 'var(--primary)' },
                    { stage: ApplicationStage.INTERVIEW, label: 'Interview', count: metrics.stageCounts[ApplicationStage.INTERVIEW] || 0, color: 'var(--accent-violet)' },
                    { stage: ApplicationStage.CLIENT_REVIEW, label: 'Client Review', count: metrics.stageCounts[ApplicationStage.CLIENT_REVIEW] || 0, color: '#f59e0b' },
                    { stage: ApplicationStage.SELECTED, label: 'Selected', count: metrics.stageCounts[ApplicationStage.SELECTED] || 0, color: '#10b981' },
                    { stage: ApplicationStage.HIRED, label: 'Hired', count: metrics.stageCounts[ApplicationStage.HIRED] || 0, color: '#059669' },
                    { stage: ApplicationStage.REJECTED, label: 'Rejected', count: metrics.stageCounts[ApplicationStage.REJECTED] || 0, color: 'var(--danger)' },
                  ].map((item) => {
                    const total = metrics.totalApplications || 1;
                    const pct = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.stage} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 500 }}>{item.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            <strong>{item.count}</strong> ({pct}%)
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: item.color,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Jobs Approaching Deadline */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={18} color="#f59e0b" /> Jobs Approaching Deadline (Next 14 Days)
                </h3>

                {metrics.jobsApproachingDeadline.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                    No published vacancies approaching deadlines in the next 14 days.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {metrics.jobsApproachingDeadline.map((job) => (
                      <div
                        key={job.id}
                        onClick={() => navigate('/jobs')}
                        style={{
                          padding: '0.75rem 1rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
                              {job.jobCode}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                              &bull; {job.clientName}
                            </span>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{job.title}</div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: job.daysRemaining <= 3 ? 'var(--danger)' : '#f59e0b',
                              background: job.daysRemaining <= 3 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                            }}
                          >
                            {job.daysRemaining === 0 ? 'Today' : `${job.daysRemaining} days left`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Recent Activity Feed */}
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="var(--primary)" /> Recent Pipeline Activity
              </h3>

              {metrics.recentActivity.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', fontSize: '0.9rem', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  No recent activity recorded yet in this workspace.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                  {metrics.recentActivity.map((act) => {
                    const date = new Date(act.timestamp);
                    return (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          paddingBottom: '0.85rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'rgba(99, 102, 241, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            marginTop: '0.15rem',
                            flexShrink: 0,
                          }}
                        >
                          <CheckCircle2 size={16} />
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                              {act.action === 'stage_transition'
                                ? `Stage moved to ${act.details?.toStage || 'new stage'}`
                                : act.action.replace(/_/g, ' ')}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                              {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {act.details?.jobCode && <span>Job: {act.details.jobCode} &bull; </span>}
                            {act.details?.candidateCode && <span>Candidate: {act.details.candidateCode} &bull; </span>}
                            {act.actor ? <span>By {act.actor.fullName} ({act.actor.role})</span> : <span>System event</span>}
                          </div>

                          {act.details?.reason && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                              &ldquo;{act.details.reason}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
