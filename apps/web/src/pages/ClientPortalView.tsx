import { useState, useEffect } from 'react';
import {
  Briefcase,
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  Clock,
  Download,
  Search,
  AlertCircle,
  Building,
  ChevronRight,
  Send,
  RefreshCw,
  X,
  FileText,
  MapPin,
  Mail,
  Phone,
  ThumbsUp,
  ThumbsDown,
  Video,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ClientPortalMe,
  ClientPortalJob,
  ClientPortalApplication,
  ApiInterview,
  fetchClientProfile,
  fetchClientJobs,
  fetchClientJobApplications,
  fetchClientApplication,
  fetchClientResumeUrl,
  clientShortlistCandidate,
  clientRejectCandidate,
  clientRequestInterview,
  clientSubmitFeedback,
  fetchClientScheduledInterviews,
} from '../lib/api';
import { ApplicationStage } from '@hiredesk/shared';

export function ClientPortalView() {
  const { session, profile } = useAuth();
  const token = session?.access_token;

  // Profile and data state
  const [clientProfile, setClientProfile] = useState<ClientPortalMe | null>(null);
  const [jobs, setJobs] = useState<ClientPortalJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applications, setApplications] = useState<ClientPortalApplication[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(true);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [jobSearch, setJobSearch] = useState<string>('');
  const [appStageFilter, setAppStageFilter] = useState<string>('');

  // Review Drawer state
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [reviewApp, setReviewApp] = useState<ClientPortalApplication | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Action Modals State
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [interviewModalOpen, setInterviewModalOpen] = useState<boolean>(false);
  const [interviewTimes, setInterviewTimes] = useState<string>('');
  const [interviewNotes, setInterviewNotes] = useState<string>('');

  // Action Feedback / Loading states
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [downloadingResume, setDownloadingResume] = useState<boolean>(false);
  const [feedbackInput, setFeedbackInput] = useState<string>('');

  // Portal Navigation Tabs & Scheduled Interviews state
  const [activePortalTab, setActivePortalTab] = useState<'candidates' | 'interviews'>('candidates');
  const [clientInterviews, setClientInterviews] = useState<ApiInterview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState<boolean>(false);
  const [interviewStatusFilter, setInterviewStatusFilter] = useState<string>('all');
  const [interviewJobFilter, setInterviewJobFilter] = useState<string>('');
  const [selectedInterviewDetail, setSelectedInterviewDetail] = useState<ApiInterview | null>(null);

  const loadClientInterviews = async () => {
    if (!token) return;
    setLoadingInterviews(true);
    try {
      const res = await fetchClientScheduledInterviews(token, {
        status: interviewStatusFilter !== 'all' ? interviewStatusFilter : undefined,
        jobId: interviewJobFilter || undefined,
      });
      setClientInterviews(res.interviews);
    } catch (err: any) {
      console.error('Failed to load scheduled interviews', err);
    } finally {
      setLoadingInterviews(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadClientInterviews();
    }
  }, [token, activePortalTab, interviewStatusFilter, interviewJobFilter]);

  // Load client profile & jobs on mount
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      setLoadingJobs(true);
      setError(null);
      try {
        const [meData, jobsData] = await Promise.all([
          fetchClientProfile(token),
          fetchClientJobs(token, { search: jobSearch || undefined }),
        ]);
        setClientProfile(meData);
        setJobs(jobsData.jobs);
        if (jobsData.jobs.length > 0 && !selectedJobId) {
          setSelectedJobId(jobsData.jobs[0].id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load client portal');
      } finally {
        setLoadingJobs(false);
      }
    };

    loadData();
  }, [token, jobSearch]);

  // Load applications when selectedJobId or appStageFilter changes
  useEffect(() => {
    if (!token || !selectedJobId) return;

    const loadApps = async () => {
      setLoadingApps(true);
      try {
        const res = await fetchClientJobApplications(token, selectedJobId, {
          stage: appStageFilter || undefined,
        });
        setApplications(res.applications);
      } catch (err: any) {
        console.error('Failed to load applications for job', err);
      } finally {
        setLoadingApps(false);
      }
    };

    loadApps();
  }, [token, selectedJobId, appStageFilter]);

  // Load application details when selectedAppId changes
  useEffect(() => {
    if (!token || !selectedAppId) {
      setReviewApp(null);
      return;
    }

    const loadAppDetail = async () => {
      setLoadingDetail(true);
      try {
        const data = await fetchClientApplication(token, selectedAppId);
        setReviewApp(data);
        setFeedbackInput(data.clientFeedback || '');
      } catch (err: any) {
        console.error('Failed to load application detail', err);
      } finally {
        setLoadingDetail(false);
      }
    };

    loadAppDetail();
  }, [token, selectedAppId]);

  // Handlers for Review Actions
  const handleShortlist = async () => {
    if (!token || !reviewApp) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await clientShortlistCandidate(token, reviewApp.id);
      setReviewApp(updated);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionNotice({ type: 'success', message: 'Candidate successfully shortlisted!' });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to shortlist candidate' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!token || !reviewApp || !rejectReason.trim()) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await clientRejectCandidate(token, reviewApp.id, rejectReason.trim());
      setReviewApp(updated);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setRejectModalOpen(false);
      setRejectReason('');
      setActionNotice({ type: 'success', message: 'Candidate marked as rejected.' });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to reject candidate' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmInterviewRequest = async () => {
    if (!token || !reviewApp) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const times = interviewTimes
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const res = await clientRequestInterview(token, reviewApp.id, times, interviewNotes.trim() || undefined);
      // Reload application detail to get updated interview request list
      const refreshed = await fetchClientApplication(token, reviewApp.id);
      setReviewApp(refreshed);
      setInterviewModalOpen(false);
      setInterviewTimes('');
      setInterviewNotes('');
      setActionNotice({
        type: 'success',
        message: res.message || 'Interview request submitted. Your recruiter will coordinate scheduling.',
      });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to request interview' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveFeedback = async () => {
    if (!token || !reviewApp || !feedbackInput.trim()) return;
    setActionLoading(true);
    setActionNotice(null);
    try {
      const updated = await clientSubmitFeedback(token, reviewApp.id, feedbackInput.trim());
      setReviewApp(updated);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setActionNotice({ type: 'success', message: 'Feedback saved successfully.' });
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to submit feedback' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!token || !reviewApp || !reviewApp.resumes.length) return;
    setDownloadingResume(true);
    try {
      const { signedUrl } = await fetchClientResumeUrl(token, reviewApp.id);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Failed to generate download link' });
    } finally {
      setDownloadingResume(false);
    }
  };

  const formatInterviewTime = (startStr: string, endStr: string, tz: string) => {
    try {
      const s = new Date(startStr);
      const e = new Date(endStr);
      const datePart = s.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const startPart = s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const endPart = e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      return `${datePart} • ${startPart} – ${endPart} (${tz})`;
    } catch {
      return `${startStr} – ${endStr} (${tz})`;
    }
  };

  // Metrics computation for client overview
  const totalAssignedJobs = jobs.length;
  const totalApplicants = jobs.reduce((acc, j) => acc + j.applicantCount, 0);
  const totalInReview = jobs.reduce((acc, j) => acc + j.reviewCount, 0);
  const totalShortlisted = jobs.reduce((acc, j) => acc + j.shortlistedCount, 0);

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Header Banner */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '4px solid var(--accent-cyan)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Building style={{ color: 'var(--accent-cyan)' }} size={20} />
            <span
              style={{
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--accent-cyan)',
                letterSpacing: '0.05em',
              }}
            >
              Client Review Portal
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            {clientProfile?.client.name || 'Client Company Portal'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Welcome, <strong>{clientProfile?.user.fullName || profile?.firstName}</strong> &bull; Agency Partner:{' '}
            <span>{clientProfile?.user.organizationName || 'Agency Partner'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="status-pill status-online">
            <span className="pulse-dot"></span> Authorized Client Session
          </span>
        </div>
      </div>

      {/* Metrics KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Vacancies</span>
            <Briefcase size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{totalAssignedJobs}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Assigned to your company</div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Candidates In Review</span>
            <Clock size={18} style={{ color: 'var(--warning)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{totalInReview}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Awaiting your decision</div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Shortlisted Candidates</span>
            <CheckCircle size={18} style={{ color: 'var(--success)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{totalShortlisted}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Approved for hiring funnels</div>
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Total Submissions</span>
            <Users size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{totalApplicants}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Across your assigned vacancies</div>
        </div>
      </div>

      {/* Portal Section Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <button
          className={`btn ${activePortalTab === 'candidates' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePortalTab('candidates')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Briefcase size={16} /> Vacancies & Candidate Review ({totalAssignedJobs})
        </button>
        <button
          className={`btn ${activePortalTab === 'interviews' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActivePortalTab('interviews')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Calendar size={16} /> Scheduled Interviews
          {clientInterviews.length > 0 && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontSize: '0.75rem',
              }}
            >
              {clientInterviews.length}
            </span>
          )}
        </button>
      </div>

      {activePortalTab === 'candidates' ? (
        /* Main Jobs & Review Section */
        <div style={{ display: 'grid', gridTemplateColumns: selectedJob ? '380px 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Left Column: Assigned Vacancies List */}
          <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={18} style={{ color: 'var(--primary)' }} /> Your Vacancies
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{jobs.length} jobs</span>
            </div>

            {/* Job Search Input */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type="text"
                placeholder="Search vacancies by title or code..."
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Job List */}
            {loadingJobs ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <RefreshCw className="spin" size={20} style={{ margin: '0 auto 0.5rem auto' }} />
                Loading your vacancies...
              </div>
            ) : jobs.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                <Briefcase size={28} className="empty-icon" />
                <div className="empty-title" style={{ fontSize: '1rem' }}>No Active Vacancies</div>
                <p className="empty-desc" style={{ fontSize: '0.8rem', margin: 0 }}>
                  No active jobs currently assigned to your client profile.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '600px', overflowY: 'auto' }}>
                {jobs.map((job) => {
                  const isSelected = job.id === selectedJobId;
                  return (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      style={{
                        padding: '1rem',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            color: 'var(--accent-cyan)',
                          }}
                        >
                          {job.jobCode}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {job.department || 'General'}
                        </span>
                      </div>

                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>{job.title}</div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Applicants: <strong>{job.applicantCount}</strong></span>
                        {job.reviewCount > 0 && (
                          <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                            &bull; {job.reviewCount} In Review
                          </span>
                        )}
                        {job.shortlistedCount > 0 && (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                            &bull; {job.shortlistedCount} Shortlisted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Applicants for Selected Job */}
          {selectedJob && (
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        background: 'rgba(255, 255, 255, 0.08)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        color: 'var(--accent-cyan)',
                      }}
                    >
                      {selectedJob.jobCode}
                    </span>
                    <h2 style={{ fontSize: '1.35rem' }}>{selectedJob.title}</h2>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                    <span>Model: <strong>{selectedJob.workplaceModel}</strong></span>
                    <span>Openings: <strong>{selectedJob.openings}</strong></span>
                    {selectedJob.deadline && (
                      <span>Deadline: <strong>{new Date(selectedJob.deadline).toLocaleDateString()}</strong></span>
                    )}
                  </div>
                </div>

                {/* Stage Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Filter:</span>
                  <select
                    value={appStageFilter}
                    onChange={(e) => setAppStageFilter(e.target.value)}
                    style={{
                      padding: '0.4rem 0.75rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#fff',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="">All Stages</option>
                    <option value={ApplicationStage.CLIENT_REVIEW}>Client Review ({selectedJob.reviewCount})</option>
                    <option value={ApplicationStage.SHORTLISTED}>Shortlisted ({selectedJob.shortlistedCount})</option>
                    <option value={ApplicationStage.APPLIED}>Applied</option>
                    <option value={ApplicationStage.INTERVIEW}>Interview</option>
                    <option value={ApplicationStage.REJECTED}>Rejected</option>
                  </select>
                </div>
              </div>

              {/* Applications Table / Cards */}
              {loadingApps ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <RefreshCw className="spin" size={24} style={{ margin: '0 auto 0.5rem auto' }} />
                  Loading candidate applications...
                </div>
              ) : applications.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem 2rem' }}>
                  <Users size={32} className="empty-icon" />
                  <div className="empty-title">No Candidates Found</div>
                  <p className="empty-desc">
                    No applicants matching the selected stage filter for this vacancy.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {applications.map((app) => {
                    const isUnderReview = app.stage === ApplicationStage.CLIENT_REVIEW;
                    const isShortlisted = app.stage === ApplicationStage.SHORTLISTED;
                    const isRejected = app.stage === ApplicationStage.REJECTED;

                    return (
                      <div
                        key={app.id}
                        style={{
                          padding: '1.25rem',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          transition: 'border-color 0.2s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(99, 102, 241, 0.1)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            {app.candidate.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{app.candidate.name}</span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontFamily: 'monospace',
                                  color: 'var(--text-dim)',
                                  background: 'rgba(255, 255, 255, 0.05)',
                                  padding: '0.1rem 0.35rem',
                                  borderRadius: '3px',
                                }}
                              >
                                {app.candidate.candidateCode}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                              <span>Applied: {new Date(app.appliedAt).toLocaleDateString()}</span>
                              {app.candidate.location && <span>&bull; {app.candidate.location}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {/* Stage Badge */}
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '0.25rem 0.65rem',
                              borderRadius: 'var(--radius-full)',
                              background: isUnderReview
                                ? 'rgba(245, 158, 11, 0.15)'
                                : isShortlisted
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isRejected
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(255, 255, 255, 0.08)',
                              color: isUnderReview
                                ? 'var(--warning)'
                                : isShortlisted
                                ? 'var(--success)'
                                : isRejected
                                ? 'var(--danger)'
                                : 'var(--text-muted)',
                              border: `1px solid ${
                                isUnderReview
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : isShortlisted
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : isRejected
                                  ? 'rgba(239, 68, 68, 0.3)'
                                  : 'var(--border-subtle)'
                              }`,
                            }}
                          >
                            {app.stage}
                          </span>

                          {/* Review Action Trigger */}
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                            onClick={() => setSelectedAppId(app.id)}
                          >
                            Review Candidate <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Scheduled Interviews Section */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Interview Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Total Interviews</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fff' }}>{clientInterviews.length}</div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Scheduled / Upcoming</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                {clientInterviews.filter((i) => i.status === 'scheduled').length}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Completed</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }}>
                {clientInterviews.filter((i) => i.status === 'completed').length}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>Cancelled / No-Show</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--danger)' }}>
                {clientInterviews.filter((i) => i.status === 'cancelled' || i.status === 'no_show').length}
              </div>
            </div>
          </div>

          {/* Filters & Controls */}
          <div
            className="glass-card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Status:</span>
                <select
                  value={interviewStatusFilter}
                  onChange={(e) => setInterviewStatusFilter(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Job:</span>
                <select
                  value={interviewJobFilter}
                  onChange={(e) => setInterviewJobFilter(e.target.value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fff',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="">All Vacancies</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.jobCode} - {j.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              className="btn btn-secondary"
              onClick={loadClientInterviews}
              disabled={loadingInterviews}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} className={loadingInterviews ? 'spin' : ''} /> Refresh
            </button>
          </div>

          {/* Interviews List */}
          {loadingInterviews ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <RefreshCw className="spin" size={24} style={{ margin: '0 auto 0.5rem auto' }} />
              Loading scheduled interviews...
            </div>
          ) : clientInterviews.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 2rem' }}>
              <Calendar size={36} className="empty-icon" />
              <div className="empty-title">No Scheduled Interviews</div>
              <p className="empty-desc">
                No interviews match the selected status or vacancy filters. Once your recruiting team schedules an interview, it will appear here with join links and calendar sync options.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {clientInterviews.map((item) => {
                const isScheduled = item.status === 'scheduled';
                const isCompleted = item.status === 'completed';
                const isCancelled = item.status === 'cancelled';

                return (
                  <div
                    key={item.id}
                    className="glass-card"
                    style={{
                      padding: '1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      borderLeft: isScheduled
                        ? '4px solid var(--accent-cyan)'
                        : isCompleted
                        ? '4px solid var(--success)'
                        : isCancelled
                        ? '4px solid var(--danger)'
                        : '4px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem',
                          textAlign: 'center',
                          minWidth: '95px',
                        }}
                      >
                        <Calendar size={18} style={{ color: 'var(--accent-cyan)', marginBottom: '0.25rem' }} />
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                          {new Date(item.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(item.startAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.candidate.name}</span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              background: 'rgba(255, 255, 255, 0.05)',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '3px',
                              color: 'var(--text-dim)',
                            }}
                          >
                            {item.candidate.candidateCode}
                          </span>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-full)',
                              background: isScheduled
                                ? 'rgba(6, 182, 212, 0.15)'
                                : isCompleted
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isCancelled
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                              color: isScheduled
                                ? 'var(--accent-cyan)'
                                : isCompleted
                                ? 'var(--success)'
                                : isCancelled
                                ? 'var(--danger)'
                                : 'var(--warning)',
                            }}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>{item.job.title}</strong> ({item.job.jobCode}) &bull; Interviewer:{' '}
                          <span>
                            {item.interviewer.fullName || `${item.interviewer.firstName} ${item.interviewer.lastName}`}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <span style={{ textTransform: 'capitalize' }}>Mode: <strong>{item.type.replace('_', ' ')}</strong></span>
                          <span>&bull; {formatInterviewTime(item.startAt, item.endAt, item.timeZone)}</span>
                          {item.location && <span>&bull; Location: {item.location}</span>}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {item.meetingUrl && !isCancelled && (
                        <a
                          href={item.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.85rem',
                            padding: '0.45rem 0.9rem',
                            textDecoration: 'none',
                          }}
                        >
                          <Video size={15} /> Join Meeting <ExternalLink size={12} />
                        </a>
                      )}

                      <a
                        href={`/api/client-portal/interviews/${item.id}/ics`}
                        download={`interview-${item.id}.ics`}
                        className="btn btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.85rem',
                          padding: '0.45rem 0.9rem',
                          textDecoration: 'none',
                        }}
                      >
                        <Download size={15} /> Add to Calendar (.ics)
                      </a>

                      <button
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
                        onClick={() => setSelectedInterviewDetail(item)}
                      >
                        <Eye size={15} /> View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Client Interview Detail Modal */}
      {selectedInterviewDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedInterviewDetail(null);
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '650px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  {selectedInterviewDetail.candidate.candidateCode}
                </span>
                <h2 style={{ fontSize: '1.4rem', marginTop: '0.25rem' }}>
                  Interview: {selectedInterviewDetail.candidate.name}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  For vacancy <strong>{selectedInterviewDetail.job.title}</strong> ({selectedInterviewDetail.job.jobCode})
                </div>
              </div>

              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
                onClick={() => setSelectedInterviewDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Confidentiality Notice */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              <strong>Confidentiality Policy:</strong> Candidate scheduling details are shared for interview coordination. Internal recruiter evaluation notes and scorecard markings remain confidential to your agency team.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Scheduled Timing:</span>
                <div style={{ fontWeight: 600, color: '#fff', marginTop: '0.2rem' }}>
                  {formatInterviewTime(
                    selectedInterviewDetail.startAt,
                    selectedInterviewDetail.endAt,
                    selectedInterviewDetail.timeZone
                  )}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Status:</span>
                <div style={{ marginTop: '0.2rem' }}>
                  <span
                    className="status-pill status-online"
                    style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}
                  >
                    {selectedInterviewDetail.status}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Interview Format:</span>
                <div style={{ fontWeight: 600, color: '#fff', textTransform: 'capitalize', marginTop: '0.2rem' }}>
                  {selectedInterviewDetail.type.replace('_', ' ')}
                  {selectedInterviewDetail.meetingProvider ? ` (${selectedInterviewDetail.meetingProvider})` : ''}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Interviewer:</span>
                <div style={{ fontWeight: 600, color: '#fff', marginTop: '0.2rem' }}>
                  {selectedInterviewDetail.interviewer.fullName ||
                    `${selectedInterviewDetail.interviewer.firstName} ${selectedInterviewDetail.interviewer.lastName}`}
                </div>
              </div>
            </div>

            {selectedInterviewDetail.location && (
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>In-Person Location:</span>
                <div style={{ color: '#fff', marginTop: '0.2rem' }}>{selectedInterviewDetail.location}</div>
              </div>
            )}

            {selectedInterviewDetail.meetingUrl && selectedInterviewDetail.status !== 'cancelled' && (
              <div
                style={{
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Meeting Join Link:</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedInterviewDetail.meetingUrl}
                  </div>
                </div>

                <a
                  href={selectedInterviewDetail.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  <Video size={14} /> Join Now
                </a>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <a
                href={`/api/client-portal/interviews/${selectedInterviewDetail.id}/ics`}
                download={`interview-${selectedInterviewDetail.id}.ics`}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
              >
                <Download size={14} /> Download .ics
              </a>
              <button className="btn btn-secondary" onClick={() => setSelectedInterviewDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Candidate Review Modal / Drawer */}
      {selectedAppId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAppId(null);
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      color: 'var(--accent-cyan)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {reviewApp?.candidate.candidateCode}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    &bull; Applied {reviewApp ? new Date(reviewApp.appliedAt).toLocaleDateString() : ''}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.5rem' }}>{reviewApp?.candidate.name || 'Loading candidate...'}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Applying for <strong>{reviewApp?.jobTitle}</strong> ({reviewApp?.jobCode})
                </div>
              </div>

              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
                onClick={() => setSelectedAppId(null)}
                aria-label="Close review dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Notice Banner */}
            {actionNotice && (
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: actionNotice.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${actionNotice.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                  color: actionNotice.type === 'success' ? 'var(--success)' : 'var(--danger)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                {actionNotice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                <span>{actionNotice.message}</span>
              </div>
            )}

            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <RefreshCw className="spin" size={24} style={{ margin: '0 auto 0.5rem auto' }} />
                Loading candidate details...
              </div>
            ) : reviewApp ? (
              <>
                {/* Pending Interview Request Alert Banner */}
                {reviewApp.interviewRequests && reviewApp.interviewRequests.length > 0 && (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      color: 'var(--text-main)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '0.9rem' }}>
                      <Calendar size={18} /> Pending Interview Request
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      A request to arrange an interview was submitted on{' '}
                      {new Date(reviewApp.interviewRequests[0].createdAt).toLocaleDateString()}. Your agency recruiter has been notified to coordinate scheduling.
                    </div>
                    {reviewApp.interviewRequests[0].preferredTimes.length > 0 && (
                      <div style={{ fontSize: '0.8rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.5rem', borderRadius: '4px' }}>
                        <strong>Requested Times:</strong> {reviewApp.interviewRequests[0].preferredTimes.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Candidate Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {reviewApp.candidate.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Mail size={16} color="var(--primary)" />
                      <span>{reviewApp.candidate.email}</span>
                    </div>
                  )}
                  {reviewApp.candidate.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Phone size={16} color="var(--primary)" />
                      <span>{reviewApp.candidate.phone}</span>
                    </div>
                  )}
                  {reviewApp.candidate.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <MapPin size={16} color="var(--primary)" />
                      <span>{reviewApp.candidate.location}</span>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {reviewApp.candidate.skills && reviewApp.candidate.skills.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Key Skills
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {reviewApp.candidate.skills.map((s, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.6rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-full)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume Download Card */}
                {reviewApp.resumes && reviewApp.resumes.length > 0 && (
                  <div
                    style={{
                      padding: '1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={20} color="var(--accent-cyan)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{reviewApp.resumes[0].originalFilename}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          {(reviewApp.resumes[0].fileSize / 1024).toFixed(0)} KB &bull; Verified Candidate Resume
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                      onClick={handleDownloadResume}
                      disabled={downloadingResume}
                    >
                      {downloadingResume ? <RefreshCw className="spin" size={14} /> : <Download size={14} />}
                      View Resume
                    </button>
                  </div>
                )}

                {/* Candidate Answers (if available) */}
                {reviewApp.answers && Object.keys(reviewApp.answers).length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Application Questionnaire
                    </div>
                    <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                      {Object.entries(reviewApp.answers).map(([q, a], idx) => (
                        <div key={idx} style={{ marginBottom: '0.5rem' }}>
                          <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{q}:</span>{' '}
                          <span style={{ color: '#fff' }}>{String(a)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Feedback Input */}
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                    Client Review Notes & Feedback
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Enter your evaluation notes visible to your agency recruiters..."
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                      onClick={handleSaveFeedback}
                      disabled={actionLoading || !feedbackInput.trim()}
                    >
                      <Send size={14} /> Save Feedback
                    </button>
                  </div>
                </div>

                {/* Action Controls Bar */}
                <div
                  style={{
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Candidate Status:</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{reviewApp.stage}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {/* Shortlist Button: allowed in Client Review */}
                    <button
                      className="btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}
                      onClick={handleShortlist}
                      disabled={actionLoading || reviewApp.stage === ApplicationStage.SHORTLISTED}
                    >
                      <ThumbsUp size={15} /> Shortlist Candidate
                    </button>

                    {/* Request Interview Button */}
                    <button
                      className="btn btn-secondary"
                      style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                      onClick={() => setInterviewModalOpen(true)}
                      disabled={actionLoading || reviewApp.stage === ApplicationStage.REJECTED}
                    >
                      <Calendar size={15} /> Request Interview
                    </button>

                    {/* Reject Button: allowed in review / shortlisted */}
                    <button
                      className="btn btn-secondary"
                      style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: 'var(--danger)' }}
                      onClick={() => setRejectModalOpen(true)}
                      disabled={actionLoading || reviewApp.stage === ApplicationStage.REJECTED}
                    >
                      <ThumbsDown size={15} /> Reject
                    </button>
                  </div>
                </div>

                {/* Stage History Log */}
                {reviewApp.stageHistories && reviewApp.stageHistories.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Review History Log
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem' }}>
                      {reviewApp.stageHistories.map((h) => (
                        <div
                          key={h.id}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '4px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <span>
                            Transitioned from <strong>{h.previousStage}</strong> to <strong>{h.nextStage}</strong>
                            {h.reason ? ` (${h.reason})` : ''}
                          </span>
                          <span style={{ color: 'var(--text-dim)' }}>{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {rejectModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <XCircle size={20} /> Confirm Candidate Rejection
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Please provide a concise reason for rejecting {reviewApp?.candidate.name}. This feedback helps your agency recruiter fine-tune future talent recommendations.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Does not meet required years of senior frontend experience"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                onClick={handleConfirmReject}
                disabled={actionLoading || !rejectReason.trim()}
              >
                {actionLoading ? <RefreshCw className="spin" size={14} /> : <ThumbsDown size={14} />} Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Interview Dialog */}
      {interviewModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div className="glass-card" style={{ maxWidth: '520px', width: '100%', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} /> Request Candidate Interview
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Specify your preferred availability and topics for {reviewApp?.candidate.name}.
            </p>

            <div
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                color: 'var(--accent-cyan)',
                fontSize: '0.8rem',
                marginBottom: '1rem',
              }}
            >
              <strong>Important Note:</strong> This records an interview request with your agency recruiting team. An official calendar invitation will be scheduled once the date and time are confirmed.
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                Preferred Times (One per line)
              </label>
              <textarea
                rows={3}
                placeholder="e.g.&#10;Monday, Oct 20 at 10:00 AM UTC&#10;Tuesday, Oct 21 at 2:00 PM UTC"
                value={interviewTimes}
                onChange={(e) => setInterviewTimes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.25rem' }}>
                Optional Instructions for Recruiter
              </label>
              <input
                type="text"
                placeholder="e.g. Focus on technical architecture and React hooks"
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setInterviewModalOpen(false);
                  setInterviewTimes('');
                  setInterviewNotes('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmInterviewRequest}
                disabled={actionLoading}
              >
                {actionLoading ? <RefreshCw className="spin" size={14} /> : <Calendar size={14} />} Submit Interview Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
