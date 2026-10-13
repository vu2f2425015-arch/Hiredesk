import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  ExternalLink,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  ApiInterview,
  ApiInterviewerOption,
  ApiPendingInterviewRequest,
  fetchInterviews,
  fetchInterview,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  completeInterview,
  recordNoShow,
  retryOutboundCommunication,
  fetchInterviewers,
  fetchPendingInterviewRequests,
  fetchJobs,
  ApiJob,
} from '../lib/api';

import { useDebounce } from '../hooks/useDebounce';

export function InterviewsView() {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const orgId = profile?.organizationId;
  const interviewsCacheKey = orgId ? `hd_interviews_cache_${orgId}` : null;

  const [interviews, setInterviews] = useState<ApiInterview[]>(() => {
    try {
      if (!interviewsCacheKey) return [];
      const cached = sessionStorage.getItem(interviewsCacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [pendingRequests, setPendingRequests] = useState<ApiPendingInterviewRequest[]>([]);
  const [interviewers, setInterviewers] = useState<ApiInterviewerOption[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [loading, setLoading] = useState<boolean>(interviews.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Modals state
  const [selectedInterview, setSelectedInterview] = useState<ApiInterview | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState<boolean>(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState<boolean>(false);
  const [isCancelOpen, setIsCancelOpen] = useState<boolean>(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState<boolean>(false);

  // Active item for reschedule / cancel / complete
  const [targetInterview, setTargetInterview] = useState<ApiInterview | null>(null);

  // Schedule modal form state
  const [scheduleForm, setScheduleForm] = useState({
    jobId: '',
    applicationId: '',
    candidateId: '',
    clientId: '',
    interviewerUserProfileId: '',
    interviewRequestId: '',
    type: 'video',
    startDate: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '10:45',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    meetingProvider: 'google_meet',
    meetingUrl: '',
    location: '',
    interviewerNotes: '',
  });

  // Reschedule form state
  const [rescheduleForm, setRescheduleForm] = useState({
    startDate: '',
    startTime: '10:00',
    endTime: '10:45',
    timeZone: 'UTC',
    reason: '',
    meetingUrl: '',
  });

  // Cancel form state
  const [cancelReason, setCancelReason] = useState<string>('');

  // Complete form state
  const [completeForm, setCompleteForm] = useState({
    feedback: '',
    result: 'passed',
    notes: '',
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [intRes, reqRes, interviewerRes, jobsRes] = await Promise.all([
        fetchInterviews(token, {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: debouncedSearch || undefined,
        }),
        fetchPendingInterviewRequests(token),
        fetchInterviewers(token),
        fetchJobs(token, { limit: 100 }),
      ]);
      setInterviews(intRes.interviews);
      if (interviewsCacheKey) {
        try {
          sessionStorage.setItem(interviewsCacheKey, JSON.stringify(intRes.interviews));
        } catch {}
      }
      setPendingRequests(reqRes);
      setInterviewers(interviewerRes);
      setJobs(jobsRes.jobs);
    } catch (err: any) {
      setError(err.message || 'Failed to load interviews data');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenScheduleForRequest = (req: ApiPendingInterviewRequest) => {
    setScheduleForm({
      jobId: req.jobId,
      applicationId: req.applicationId,
      candidateId: req.application.candidate.id,
      clientId: req.clientId,
      interviewerUserProfileId: profile?.id || (interviewers[0]?.id || ''),
      interviewRequestId: req.id,
      type: 'video',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '11:00',
      endTime: '11:45',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      meetingProvider: 'google_meet',
      meetingUrl: '',
      location: '',
      interviewerNotes: req.notes ? `Client Request Notes: ${req.notes}` : '',
    });
    setFormError(null);
    setIsScheduleOpen(true);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const startIso = new Date(`${scheduleForm.startDate}T${scheduleForm.startTime}:00`).toISOString();
      const endIso = new Date(`${scheduleForm.startDate}T${scheduleForm.endTime}:00`).toISOString();

      await scheduleInterview(token, {
        applicationId: scheduleForm.applicationId,
        jobId: scheduleForm.jobId,
        candidateId: scheduleForm.candidateId,
        clientId: scheduleForm.clientId,
        interviewerUserProfileId: scheduleForm.interviewerUserProfileId,
        interviewRequestId: scheduleForm.interviewRequestId || null,
        type: scheduleForm.type,
        startAt: startIso,
        endAt: endIso,
        timeZone: scheduleForm.timeZone,
        meetingProvider: scheduleForm.meetingProvider || null,
        meetingUrl: scheduleForm.meetingUrl || null,
        location: scheduleForm.location || null,
        interviewerNotes: scheduleForm.interviewerNotes || null,
      });

      setIsScheduleOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to schedule interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetInterview) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const startIso = new Date(`${rescheduleForm.startDate}T${rescheduleForm.startTime}:00`).toISOString();
      const endIso = new Date(`${rescheduleForm.startDate}T${rescheduleForm.endTime}:00`).toISOString();

      await rescheduleInterview(token, targetInterview.id, {
        startAt: startIso,
        endAt: endIso,
        timeZone: rescheduleForm.timeZone,
        reason: rescheduleForm.reason,
        meetingUrl: rescheduleForm.meetingUrl || targetInterview.meetingUrl,
      });

      setIsRescheduleOpen(false);
      setTargetInterview(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to reschedule interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetInterview) return;
    setSubmitting(true);
    setFormError(null);

    try {
      await cancelInterview(token, targetInterview.id, cancelReason);
      setIsCancelOpen(false);
      setTargetInterview(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to cancel interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetInterview) return;
    setSubmitting(true);
    setFormError(null);

    try {
      await completeInterview(token, targetInterview.id, {
        feedback: completeForm.feedback,
        result: completeForm.result,
        interviewerNotes: completeForm.notes,
      });
      setIsCompleteOpen(false);
      setTargetInterview(null);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to complete interview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkNoShow = async (interview: ApiInterview) => {
    if (!token) return;
    if (!window.confirm(`Mark ${interview.candidate.name} as No-Show for this interview?`)) return;

    try {
      await recordNoShow(token, interview.id, 'Marked by recruiter');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record no-show');
    }
  };

  const handleRetryEmail = async (interviewId: string, commId: string) => {
    if (!token) return;
    try {
      await retryOutboundCommunication(token, interviewId, commId);
      const updated = await fetchInterview(token, interviewId);
      setSelectedInterview(updated);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to retry email delivery');
    }
  };

  const scheduledCount = interviews.filter((i) => i.status === 'scheduled' || i.status === 'rescheduled').length;
  const completedCount = interviews.filter((i) => i.status === 'completed').length;
  const cancelledCount = interviews.filter((i) => i.status === 'cancelled').length;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CalendarIcon size={28} color="var(--primary)" />
            Interview Management
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Coordinate candidates, assign interviewers, dispatch honest SMTP invitations, and track calendar events.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}
          onClick={() => {
            setScheduleForm({
              jobId: jobs[0]?.id || '',
              applicationId: '',
              candidateId: '',
              clientId: jobs[0]?.clientId || '',
              interviewerUserProfileId: profile?.id || (interviewers[0]?.id || ''),
              interviewRequestId: '',
              type: 'video',
              startDate: new Date().toISOString().split('T')[0],
              startTime: '10:00',
              endTime: '10:45',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              meetingProvider: 'google_meet',
              meetingUrl: '',
              location: '',
              interviewerNotes: '',
            });
            setFormError(null);
            setIsScheduleOpen(true);
          }}
        >
          <Plus size={18} /> Schedule Interview
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL INTERVIEWS</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem' }}>{interviews.length}</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>SCHEDULED / UPCOMING</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#3b82f6' }}>{scheduledCount}</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMPLETED</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#10b981' }}>{completedCount}</div>
        </div>

        <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>CANCELLED</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.35rem', color: '#ef4444' }}>{cancelledCount}</div>
        </div>
      </div>

      {/* Pending Client Requests Banner */}
      {pendingRequests.length > 0 && (
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>
              Pending Client Interview Requests ({pendingRequests.length})
            </h3>
          </div>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            These applicants were reviewed and requested by clients. Take scheduling action to coordinate interviewer time and send invites.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{req.application.candidate.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {req.job.title} &bull; <span style={{ color: 'var(--primary)' }}>{req.client.name}</span>
                  </div>
                  {req.preferredTimes?.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      Pref: {req.preferredTimes.join(', ')}
                    </div>
                  )}
                  {req.notes && (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      &ldquo;{req.notes}&rdquo;
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', borderColor: '#f59e0b', color: '#f59e0b' }}
                  onClick={() => handleOpenScheduleForRequest(req)}
                >
                  Schedule
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['all', 'scheduled', 'completed', 'rescheduled', 'cancelled', 'no_show'].map((status) => (
            <button
              key={status}
              className={`btn ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', textTransform: 'capitalize' }}
              onClick={() => setStatusFilter(status)}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div className="search-box-wrapper" style={{ width: '260px' }}>
            <Search size={15} />
            <input
              type="text"
              className="input"
              placeholder="Search candidate, job code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button className="btn btn-secondary" onClick={loadData} title="Refresh" style={{ height: '38px', padding: '0 0.75rem' }}>
            <RefreshCw size={15} className={loading ? 'pulse-dot' : ''} />
          </button>
        </div>
      </div>

      {loading && interviews.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '50%' }}>
                <div className="skeleton" style={{ width: '45%', height: '16px' }} />
                <div className="skeleton" style={{ width: '70%', height: '12px' }} />
              </div>
              <div className="skeleton" style={{ width: '80px', height: '26px' }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
          <AlertTriangle size={32} style={{ marginBottom: '0.5rem' }} />
          <div>{error}</div>
        </div>
      ) : interviews.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CalendarIcon size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>No interviews found</h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {statusFilter !== 'all' || searchQuery ? 'No interviews match your filters.' : 'Get started by scheduling an interview.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Candidate</th>
                <th style={{ padding: '0.85rem 1rem' }}>Job &amp; Client</th>
                <th style={{ padding: '0.85rem 1rem' }}>Schedule</th>
                <th style={{ padding: '0.85rem 1rem' }}>Interviewer</th>
                <th style={{ padding: '0.85rem 1rem' }}>Mode</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>Email Delivery</th>
                <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {interviews.map((item) => {
                const startDate = new Date(item.startAt);
                const endDate = new Date(item.endAt);
                const formattedDate = startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const formattedTime = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                const lastComm = item.communications?.[0];

                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{item.candidate.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.candidate.candidateCode}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div>{item.job.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--primary)' }}>{item.job.jobCode}</span> &bull; {item.client.name}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600 }}>{formattedDate}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {formattedTime} ({item.timeZone})
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div>{item.interviewer.fullName || `${item.interviewer.firstName} ${item.interviewer.lastName}`}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        {item.type}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          textTransform: 'capitalize',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontWeight: 600,
                          background:
                            item.status === 'scheduled'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : item.status === 'completed'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : item.status === 'rescheduled'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                          color:
                            item.status === 'scheduled'
                              ? '#3b82f6'
                              : item.status === 'completed'
                              ? '#10b981'
                              : item.status === 'rescheduled'
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {lastComm ? (
                        <span
                          title={lastComm.errorMessage || `Attempt ${lastComm.attemptCount}`}
                          style={{
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color:
                              lastComm.status === 'sent'
                                ? '#10b981'
                                : lastComm.status === 'queued' || lastComm.status === 'sending'
                                ? '#f59e0b'
                                : '#ef4444',
                          }}
                        >
                          {lastComm.status === 'sent' ? (
                            <CheckCircle2 size={13} />
                          ) : lastComm.status === 'queued' ? (
                            <Clock size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}
                          {lastComm.status}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setSelectedInterview(item);
                            setIsDetailOpen(true);
                          }}
                        >
                          Details
                        </button>

                        {item.status === 'scheduled' || item.status === 'rescheduled' ? (
                          <>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                              onClick={() => {
                                setTargetInterview(item);
                                setRescheduleForm({
                                  startDate: item.startAt.split('T')[0],
                                  startTime: '10:00',
                                  endTime: '10:45',
                                  timeZone: item.timeZone,
                                  reason: '',
                                  meetingUrl: item.meetingUrl || '',
                                });
                                setIsRescheduleOpen(true);
                              }}
                              title="Reschedule"
                            >
                              Reschedule
                            </button>

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981' }}
                              onClick={() => {
                                setTargetInterview(item);
                                setCompleteForm({ feedback: '', result: 'passed', notes: '' });
                                setIsCompleteOpen(true);
                              }}
                              title="Complete"
                            >
                              Complete
                            </button>

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444' }}
                              onClick={() => {
                                setTargetInterview(item);
                                setCancelReason('');
                                setIsCancelOpen(true);
                              }}
                              title="Cancel"
                            >
                              Cancel
                            </button>

                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#f59e0b' }}
                              onClick={() => handleMarkNoShow(item)}
                              title="Mark No-Show"
                            >
                              No-Show
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Drawer Modal */}
      {isDetailOpen && selectedInterview && (
        <div className="modal-backdrop" onClick={() => setIsDetailOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: 640 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Interview Details</h2>
              <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => setIsDetailOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CANDIDATE</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selectedInterview.candidate.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{selectedInterview.candidate.candidateCode}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>JOB &amp; CLIENT</div>
                <div style={{ fontWeight: 700 }}>{selectedInterview.job.title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedInterview.client.name}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DATE &amp; TIME</div>
                <div>{new Date(selectedInterview.startAt).toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Timezone: {selectedInterview.timeZone}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INTERVIEWER</div>
                <div>{selectedInterview.interviewer.fullName || `${selectedInterview.interviewer.firstName} ${selectedInterview.interviewer.lastName}`}</div>
              </div>
            </div>

            {selectedInterview.meetingUrl && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>MEETING LINK</div>
                <a
                  href={selectedInterview.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', wordBreak: 'break-all' }}
                >
                  <Video size={16} /> {selectedInterview.meetingUrl} <ExternalLink size={14} />
                </a>
              </div>
            )}

            {selectedInterview.interviewerNotes && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.25rem' }}>
                  INTERNAL RECRUITER NOTES (CONFIDENTIAL)
                </div>
                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{selectedInterview.interviewerNotes}</div>
              </div>
            )}

            {selectedInterview.feedback && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginBottom: '0.25rem' }}>
                  EVALUATION RESULT: {selectedInterview.result?.toUpperCase()}
                </div>
                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{selectedInterview.feedback}</div>
              </div>
            )}

            {/* Email Communications History */}
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>Outbound Communication Log</h4>
              {selectedInterview.communications && selectedInterview.communications.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedInterview.communications.map((comm) => (
                    <div
                      key={comm.id}
                      style={{
                        padding: '0.6rem 0.8rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{comm.subject}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                          To: {comm.recipientEmail} &bull; Template: {comm.templateId}
                        </div>
                        {comm.errorMessage && (
                          <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                            Error: {comm.errorMessage}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            textTransform: 'uppercase',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: comm.status === 'sent' ? '#10b981' : comm.status === 'queued' ? '#f59e0b' : '#ef4444',
                          }}
                        >
                          {comm.status}
                        </span>

                        {comm.status === 'failed' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            onClick={() => handleRetryEmail(selectedInterview.id, comm.id)}
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No outbound communications logged.</div>
              )}
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <a
                href={`/api/interviews/${selectedInterview.id}/ics`}
                download={`interview-${selectedInterview.id}.ics`}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                <Download size={14} /> Download .ics
              </a>

              <button className="btn btn-secondary" onClick={() => setIsDetailOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleOpen && (
        <div className="modal-backdrop" onClick={() => setIsScheduleOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Schedule Interview</h2>
              <button className="btn btn-secondary" style={{ padding: '0.3rem' }} onClick={() => setIsScheduleOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={scheduleForm.startDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Time Zone</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={scheduleForm.timeZone}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, timeZone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">End Time</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="label">Assigned Interviewer</label>
                <select
                  className="input"
                  required
                  value={scheduleForm.interviewerUserProfileId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, interviewerUserProfileId: e.target.value })}
                >
                  <option value="">Select Interviewer...</option>
                  {interviewers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.fullName || `${i.firstName} ${i.lastName}`} ({i.role})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="label">Interview Format</label>
                  <select
                    className="input"
                    value={scheduleForm.type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                  >
                    <option value="video">Video Call</option>
                    <option value="phone">Phone Screen</option>
                    <option value="technical">Technical Assessment</option>
                    <option value="onsite">On-Site</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="label">Meeting Provider</label>
                  <select
                    className="input"
                    value={scheduleForm.meetingProvider}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, meetingProvider: e.target.value })}
                  >
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                    <option value="phone">Phone</option>
                    <option value="onsite">On-Site</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="label">Meeting URL</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://meet.google.com/xyz"
                  value={scheduleForm.meetingUrl}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, meetingUrl: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Internal Recruiter Notes (Confidential)</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Private notes (never visible to candidate or client)..."
                  value={scheduleForm.interviewerNotes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, interviewerNotes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Scheduling...' : 'Schedule & Dispatch Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {isRescheduleOpen && targetInterview && (
        <div className="modal-backdrop" onClick={() => setIsRescheduleOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 700 }}>
              Reschedule Interview with {targetInterview.candidate.name}
            </h2>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="label">New Date</label>
                  <input
                    type="date"
                    className="input"
                    required
                    value={rescheduleForm.startDate}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Time Zone</label>
                  <input
                    type="text"
                    className="input"
                    required
                    value={rescheduleForm.timeZone}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, timeZone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Start Time</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={rescheduleForm.startTime}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">End Time</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={rescheduleForm.endTime}
                    onChange={(e) => setRescheduleForm({ ...rescheduleForm, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label className="label">Reason for Rescheduling</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Interviewer scheduling conflict"
                  value={rescheduleForm.reason}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Meeting Link (optional update)</label>
                <input
                  type="url"
                  className="input"
                  value={rescheduleForm.meetingUrl}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, meetingUrl: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsRescheduleOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelOpen && targetInterview && (
        <div className="modal-backdrop" onClick={() => setIsCancelOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>
              Cancel Interview
            </h2>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Cancelling will update status to cancelled and dispatch cancellation notice to candidate.
            </p>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Cancellation Reason (Mandatory)</label>
                <textarea
                  className="input"
                  rows={3}
                  required
                  placeholder="Explain reason for cancellation..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCancelOpen(false)}>
                  Back
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#ef4444', color: '#fff' }}
                  disabled={submitting || !cancelReason.trim()}
                >
                  {submitting ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {isCompleteOpen && targetInterview && (
        <div className="modal-backdrop" onClick={() => setIsCompleteOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', fontWeight: 700 }}>
              Complete Interview with {targetInterview.candidate.name}
            </h2>

            {formError && (
              <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCompleteSubmit}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label className="label">Evaluation Result</label>
                <select
                  className="input"
                  value={completeForm.result}
                  onChange={(e) => setCompleteForm({ ...completeForm, result: e.target.value })}
                >
                  <option value="passed">Passed</option>
                  <option value="strong_hire">Strong Hire</option>
                  <option value="pending">Pending Further Review</option>
                  <option value="failed">Did Not Pass</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="label">Feedback &amp; Evaluation</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Summary of performance, key strengths, weaknesses..."
                  value={completeForm.feedback}
                  onChange={(e) => setCompleteForm({ ...completeForm, feedback: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCompleteOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
