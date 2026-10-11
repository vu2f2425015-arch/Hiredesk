import { useState, useEffect } from 'react';
import {
  X,
  User,
  Briefcase,
  Download,
  Lock,
  MessageSquare,
  Check,
  AlertCircle,
  RefreshCw,
  Send,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  CandidateProfile,
  fetchCandidateProfile,
  updateApplicationNotes,
  transitionApplicationStage,
  fetchResumeDownloadUrl,
} from '../lib/api';
import { ApplicationStage, UserRole } from '@hiredesk/shared';

interface CandidateProfileModalProps {
  candidateId: string;
  initialApplicationId?: string;
  onClose: () => void;
  onApplicationUpdated?: () => void;
}

export function CandidateProfileModal({
  candidateId,
  initialApplicationId,
  onClose,
  onApplicationUpdated,
}: CandidateProfileModalProps) {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const isClient = profile?.role === UserRole.CLIENT;

  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(initialApplicationId || null);
  const [downloadingResumeId, setDownloadingResumeId] = useState<string | null>(null);

  // Notes editing state
  const [recruiterNotes, setRecruiterNotes] = useState<string>('');
  const [clientFeedback, setClientFeedback] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const [notesSavedNotice, setNotesSavedNotice] = useState<string | null>(null);

  // Stage transition state
  const [transitioningStage, setTransitioningStage] = useState<boolean>(false);
  const [selectedTargetStage, setSelectedTargetStage] = useState<string>('');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [stageNotice, setStageNotice] = useState<string | null>(null);

  const loadProfile = async () => {
    if (!token || !candidateId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCandidateProfile(token, candidateId);
      setCandidate(data);

      const activeApp = selectedAppId
        ? data.applications.find((a) => a.id === selectedAppId)
        : data.applications[0];

      if (activeApp) {
        setSelectedAppId(activeApp.id);
        setRecruiterNotes(activeApp.recruiterNotes || '');
        setClientFeedback(activeApp.clientFeedback || '');
        setSelectedTargetStage(activeApp.stage);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load candidate profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [token, candidateId]);

  const activeApplication = candidate?.applications.find((a) => a.id === selectedAppId) || candidate?.applications[0];

  const handleSelectApplication = (appId: string) => {
    setSelectedAppId(appId);
    const target = candidate?.applications.find((a) => a.id === appId);
    if (target) {
      setRecruiterNotes(target.recruiterNotes || '');
      setClientFeedback(target.clientFeedback || '');
      setSelectedTargetStage(target.stage);
    }
  };

  const handleDownloadResume = async (appId: string) => {
    if (!token) return;
    setDownloadingResumeId(appId);
    try {
      const { signedUrl } = await fetchResumeDownloadUrl(token, appId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Resume download failed: ${err.message}`);
    } finally {
      setDownloadingResumeId(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!token || !activeApplication) return;
    setSavingNotes(true);
    setNotesSavedNotice(null);
    try {
      const payload: { recruiterNotes?: string; clientFeedback?: string } = {};
      if (!isClient) {
        payload.recruiterNotes = recruiterNotes;
      }
      payload.clientFeedback = clientFeedback;

      await updateApplicationNotes(token, activeApplication.id, payload);
      setNotesSavedNotice('Notes updated successfully');
      setTimeout(() => setNotesSavedNotice(null), 3000);
      onApplicationUpdated?.();
      await loadProfile();
    } catch (err: any) {
      alert(`Failed to save notes: ${err.message}`);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleTransitionStage = async () => {
    if (!token || !activeApplication || !selectedTargetStage) return;
    if (selectedTargetStage === activeApplication.stage) return;
    setTransitioningStage(true);
    setStageNotice(null);
    try {
      await transitionApplicationStage(token, activeApplication.id, selectedTargetStage, transitionReason || undefined);
      setStageNotice(`Application moved to ${selectedTargetStage}`);
      setTransitionReason('');
      setTimeout(() => setStageNotice(null), 3000);
      onApplicationUpdated?.();
      await loadProfile();
    } catch (err: any) {
      alert(`Stage transition failed: ${err.message}`);
    } finally {
      setTransitioningStage(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '920px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <User size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{candidate?.name || 'Candidate Profile'}</h2>
                {candidate?.candidateCode && (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: 'var(--primary)',
                      background: 'rgba(99, 102, 241, 0.15)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {candidate.candidateCode}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {candidate?.email} {candidate?.phone ? `• ${candidate.phone}` : ''}{' '}
                {candidate?.location ? `• ${candidate.location}` : ''}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
              <p>Loading candidate profile from database...</p>
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
          ) : !candidate ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
              Candidate profile not found.
            </div>
          ) : (
            <>
              {/* Skills and Background Summary */}
              {candidate.skills && candidate.skills.length > 0 && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.4rem' }}>
                    Candidate Skills
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {candidate.skills.map((s, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: 'var(--primary)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Multi-Job Applications Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Briefcase size={16} color="var(--primary)" /> Applications ({candidate.applications.length})
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Scoped to caller organization & client authorization
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                  {candidate.applications.map((app) => {
                    const isSelected = app.id === selectedAppId;
                    return (
                      <div
                        key={app.id}
                        onClick={() => handleSelectApplication(app.id)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          minWidth: '220px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)' }}>
                            {app.job.jobCode}
                          </span>
                          <span className="status-pill status-online" style={{ fontSize: '0.65rem' }}>
                            {app.stage}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {app.job.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Applied {new Date(app.appliedAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Application Detail Card */}
              {activeApplication && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Active Application View
                      </span>
                      <h4 style={{ fontSize: '1.1rem', margin: '0.2rem 0' }}>{activeApplication.job.title}</h4>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Job Code: <strong>{activeApplication.job.jobCode}</strong> &bull; Client: {activeApplication.job.client?.name || 'Internal'} &bull; Source: {activeApplication.source}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDownloadResume(activeApplication.id)}
                        disabled={downloadingResumeId === activeApplication.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                      >
                        {downloadingResumeId === activeApplication.id ? (
                          <RefreshCw className="pulse-dot" size={14} />
                        ) : (
                          <Download size={14} />
                        )}
                        <span>Download Resume</span>
                      </button>
                    </div>
                  </div>

                  {/* Pending Client Interview Request Indicator */}
                  {(activeApplication as any).interviewRequests && (activeApplication as any).interviewRequests.length > 0 && (
                    <div
                      style={{
                        padding: '0.85rem 1rem',
                        background: 'rgba(6, 182, 212, 0.12)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <Calendar size={16} /> Pending Client Interview Request
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Client requested an interview on {new Date((activeApplication as any).interviewRequests[0].createdAt).toLocaleDateString()}.
                        {(activeApplication as any).interviewRequests[0].preferredTimes?.length > 0 && (
                          <span> Preferred times: <strong>{(activeApplication as any).interviewRequests[0].preferredTimes.join(', ')}</strong></span>
                        )}
                        {(activeApplication as any).interviewRequests[0].notes && (
                          <span> &bull; Notes: "{(activeApplication as any).interviewRequests[0].notes}"</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stage Transition Control */}
                  <div
                    style={{
                      padding: '1rem',
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Current Stage:</span>
                      <span className="status-pill status-online" style={{ fontSize: '0.75rem' }}>
                        {activeApplication.stage}
                      </span>
                    </div>

                    {stageNotice && (
                      <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Check size={14} /> {stageNotice}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                      <select
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
                      >
                        <option value={ApplicationStage.APPLIED}>Applied</option>
                        <option value={ApplicationStage.SCREENING}>Screening</option>
                        <option value={ApplicationStage.SHORTLISTED}>Shortlisted</option>
                        <option value={ApplicationStage.INTERVIEW}>Interview</option>
                        <option value={ApplicationStage.AI_INTERVIEW}>AI Interview</option>
                        <option value={ApplicationStage.CLIENT_REVIEW}>Client Review</option>
                        <option value={ApplicationStage.SELECTED}>Selected</option>
                        <option value={ApplicationStage.HIRED}>Hired</option>
                        <option value={ApplicationStage.REJECTED}>Rejected</option>
                        <option value={ApplicationStage.WITHDRAWN}>Withdrawn</option>
                      </select>

                      <input
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
                      />

                      <button
                        className="btn btn-primary"
                        onClick={handleTransitionStage}
                        disabled={transitioningStage || selectedTargetStage === activeApplication.stage}
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                      >
                        {transitioningStage ? 'Updating...' : 'Move Stage'}
                      </button>
                    </div>
                  </div>

                  {/* Notes & Feedback Section with Strict Role Separation */}
                  <div style={{ display: 'grid', gridTemplateColumns: isClient ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                    {/* Internal Recruiter Notes (Completely hidden from client) */}
                    {!isClient && (
                      <div
                        style={{
                          padding: '1rem',
                          background: 'rgba(99, 102, 241, 0.05)',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                          <Lock size={14} /> Internal Recruiter Notes
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 400 }}>(Invisible to Client)</span>
                        </div>
                        <textarea
                          rows={4}
                          value={recruiterNotes}
                          onChange={(e) => setRecruiterNotes(e.target.value)}
                          placeholder="Internal agency assessments, salary expectations, recruiter impressions..."
                          style={{
                            width: '100%',
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--text-main)',
                            padding: '0.5rem',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>
                    )}

                    {/* Client Visible Feedback */}
                    <div
                      style={{
                        padding: '1rem',
                        background: 'rgba(6, 182, 212, 0.05)',
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.85rem' }}>
                        <MessageSquare size={14} /> Client Feedback
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 400 }}>(Shared with Client & Agency)</span>
                      </div>
                      <textarea
                        rows={4}
                        value={clientFeedback}
                        onChange={(e) => setClientFeedback(e.target.value)}
                        placeholder="Feedback on candidate profile, interview availability, hiring decision..."
                        style={{
                          width: '100%',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-main)',
                          padding: '0.5rem',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {notesSavedNotice && (
                      <span style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Check size={14} /> {notesSavedNotice}
                      </span>
                    )}
                    <button
                      className="btn btn-primary"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                      {savingNotes ? <RefreshCw className="pulse-dot" size={14} /> : <Send size={14} />}
                      Save Notes & Feedback
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
