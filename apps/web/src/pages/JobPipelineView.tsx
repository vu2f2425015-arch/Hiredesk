import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Download,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  JobPipeline,
  fetchJobPipeline,
  transitionApplicationStage,
  fetchResumeDownloadUrl,
} from '../lib/api';
import { CandidateProfileModal } from './CandidateProfileModal';
import { ApplicationStage, UserRole } from '@hiredesk/shared';

interface JobPipelineViewProps {
  jobId: string;
  onClose?: () => void;
}

const PIPELINE_COLUMNS: Array<{ stage: string; label: string; color: string }> = [
  { stage: ApplicationStage.APPLIED, label: 'Applied', color: 'var(--text-muted)' },
  { stage: ApplicationStage.SCREENING, label: 'Screening', color: 'var(--accent-cyan)' },
  { stage: ApplicationStage.SHORTLISTED, label: 'Shortlisted', color: 'var(--primary)' },
  { stage: ApplicationStage.INTERVIEW, label: 'Interview', color: 'var(--accent-violet)' },
  { stage: ApplicationStage.CLIENT_REVIEW, label: 'Client Review', color: '#f59e0b' },
  { stage: ApplicationStage.SELECTED, label: 'Selected', color: '#10b981' },
  { stage: ApplicationStage.HIRED, label: 'Hired', color: '#059669' },
  { stage: ApplicationStage.REJECTED, label: 'Rejected', color: 'var(--danger)' },
];

export function JobPipelineView({ jobId, onClose }: JobPipelineViewProps) {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const isClient = profile?.role === UserRole.CLIENT;

  const [pipeline, setPipeline] = useState<JobPipeline | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected candidate modal state
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);

  // Stage transition tracking
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  const loadPipeline = useCallback(async () => {
    if (!token || !jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobPipeline(token, jobId);
      setPipeline(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [token, jobId]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  const handleStageMove = async (applicationId: string, currentStage: string, nextStage: string) => {
    if (!token || currentStage === nextStage) return;

    // Boundary check for client role
    if (isClient && currentStage !== ApplicationStage.CLIENT_REVIEW) {
      alert('Client users can only transition applications currently in Client Review');
      return;
    }

    setUpdatingAppId(applicationId);
    try {
      await transitionApplicationStage(token, applicationId, nextStage);
      await loadPipeline();
    } catch (err: any) {
      alert(`Transition failed: ${err.message}`);
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleDownloadResume = async (e: React.MouseEvent, applicationId: string) => {
    e.stopPropagation();
    if (!token) return;
    setDownloadingResumeId(applicationId);
    try {
      const { signedUrl } = await fetchResumeDownloadUrl(token, applicationId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%' }}>
      {/* Pipeline Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'var(--primary)',
                background: 'rgba(99, 102, 241, 0.15)',
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              {pipeline?.job.jobCode || 'JOB'}
            </span>
            <h2 style={{ fontSize: '1.35rem', margin: 0 }}>{pipeline?.job.title || 'Candidate Pipeline'}</h2>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Total Applications: <strong>{pipeline?.totalApplications ?? 0}</strong> &bull; Client:{' '}
            {pipeline?.job.client?.name || 'Internal'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={loadPipeline} title="Refresh pipeline">
            <RefreshCw size={14} /> Refresh
          </button>
          {onClose && (
            <button className="btn btn-secondary" onClick={onClose}>
              Back to Job List
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
          <p>Loading candidate pipeline columns...</p>
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
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={20} /> {error}
        </div>
      ) : (
        /* Kanban Pipeline Columns */
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            overflowX: 'auto',
            paddingBottom: '1rem',
            alignItems: 'flex-start',
            minHeight: '480px',
          }}
        >
          {PIPELINE_COLUMNS.map((col) => {
            const apps = pipeline?.stages[col.stage] || [];
            return (
              <div
                key={col.stage}
                style={{
                  minWidth: '280px',
                  maxWidth: '300px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '75vh',
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: col.color,
                        display: 'inline-block',
                      }}
                    />
                    <strong style={{ fontSize: '0.9rem' }}>{col.label}</strong>
                  </div>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {apps.length}
                  </span>
                </div>

                {/* Candidate Cards in Column */}
                <div
                  style={{
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    overflowY: 'auto',
                    flex: 1,
                  }}
                >
                  {apps.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '2rem 1rem',
                        color: 'var(--text-dim)',
                        fontSize: '0.8rem',
                        border: '1px dashed rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      No candidates in {col.label}
                    </div>
                  ) : (
                    apps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => {
                          setActiveCandidateId(app.candidate.id);
                          setActiveApplicationId(app.id);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.85rem',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              color: 'var(--primary)',
                            }}
                          >
                            {app.candidate.candidateCode}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {new Date(app.appliedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{app.candidate.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {app.candidate.normalizedEmail}
                        </div>

                        {app.hasPendingInterviewRequest && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              color: '#fbbf24',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                            }}
                          >
                            <Calendar size={12} />
                            <span>Interview Requested</span>
                          </div>
                        )}

                        {app.candidate.skills && app.candidate.skills.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                            {app.candidate.skills.slice(0, 3).map((s, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: '0.7rem',
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  color: 'var(--primary)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                }}
                              >
                                {s}
                              </span>
                            ))}
                            {app.candidate.skills.length > 3 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                +{app.candidate.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Card Actions: Accessible Stage Switcher and Resume Button */}
                        <div
                          style={{
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            paddingTop: '0.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Resume download icon */}
                          {app.resumes && app.resumes.length > 0 ? (
                            <button
                              onClick={(e) => handleDownloadResume(e, app.id)}
                              disabled={downloadingResumeId === app.id}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-dim)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.75rem',
                              }}
                              title="Download resume"
                            >
                              <Download size={13} />
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>No file</span>
                          )}

                          {/* Quick Accessible Stage Transition Dropdown */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <select
                              value={app.stage}
                              onChange={(e) => handleStageMove(app.id, app.stage, e.target.value)}
                              disabled={updatingAppId === app.id || (isClient && app.stage !== ApplicationStage.CLIENT_REVIEW)}
                              style={{
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-main)',
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.4rem',
                                borderRadius: '4px',
                                outline: 'none',
                              }}
                              title="Move candidate stage"
                            >
                              <option value={ApplicationStage.APPLIED}>Applied</option>
                              <option value={ApplicationStage.SCREENING}>Screening</option>
                              <option value={ApplicationStage.SHORTLISTED}>Shortlisted</option>
                              <option value={ApplicationStage.INTERVIEW}>Interview</option>
                              <option value={ApplicationStage.CLIENT_REVIEW}>Client Review</option>
                              <option value={ApplicationStage.SELECTED}>Selected</option>
                              <option value={ApplicationStage.HIRED}>Hired</option>
                              <option value={ApplicationStage.REJECTED}>Reject</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Candidate Profile Drawer / Modal */}
      {activeCandidateId && (
        <CandidateProfileModal
          candidateId={activeCandidateId}
          initialApplicationId={activeApplicationId || undefined}
          onClose={() => {
            setActiveCandidateId(null);
            setActiveApplicationId(null);
          }}
          onApplicationUpdated={loadPipeline}
        />
      )}
    </div>
  );
}
