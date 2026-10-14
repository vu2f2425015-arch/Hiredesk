import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/config';
import {
  Inbox,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Slash,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { InboundStatus, UserRole } from '@hiredesk/shared';

interface InboundApplicationItem {
  id: string;
  mailboxId: string;
  uidValidity: string;
  uid: string;
  messageId: string | null;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  recipientEmail: string;
  receivedAt: string;
  extractedJobCode: string | null;
  matchedJobId: string | null;
  matchedOrgId: string | null;
  matchedClientId: string | null;
  status: string;
  failureReason: string | null;
  attemptCount: number;
  lastAttemptAt: string | null;
  processedAt: string | null;
  linkedCandidateId: string | null;
  linkedApplicationId: string | null;
  rawPayload: any;
}

interface AvailableJob {
  id: string;
  jobCode: string;
  title: string;
  client: { name: string };
  status: string;
  organizationId: string;
}

export function UnmatchedApplicationsView() {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<InboundApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Assignment Modal State
  const [assignTarget, setAssignTarget] = useState<InboundApplicationItem | null>(null);
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Ignore Modal State
  const [ignoreTarget, setIgnoreTarget] = useState<InboundApplicationItem | null>(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [ignoreLoading, setIgnoreLoading] = useState(false);

  // Action Success Banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchItems = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('page', String(page));
      params.append('limit', '20');

      const res = await fetch(`${API_BASE}/api/admin/inbound-applications?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Access denied: You do not have permission to view the inbound queue.');
        }
        throw new Error(`Failed to load inbound applications (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data.items || []);
        setTotal(json.data.total || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inbound records');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobsForAssignment = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE}/api/jobs?status=published&limit=100`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.jobs) {
          setAvailableJobs(json.data.jobs);
        }
      }
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    fetchItems();
  }, [session?.access_token, statusFilter, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchItems();
  };

  const handleOpenAssignModal = (item: InboundApplicationItem) => {
    setAssignTarget(item);
    setSelectedJobId('');
    setAssignError(null);
    fetchJobsForAssignment();
  };

  const handleExecuteAssign = async () => {
    if (!assignTarget || !selectedJobId || !session?.access_token) return;
    setAssignLoading(true);
    setAssignError(null);

    try {
      const res = await fetch(`${API_BASE}/api/admin/inbound-applications/${assignTarget.id}/assign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: selectedJobId }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to assign application');
      }

      setSuccessBanner(`Successfully assigned inbound application to job!`);
      setAssignTarget(null);
      fetchItems();
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      setAssignError(err.message || 'Assignment failed');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleExecuteRetry = async (item: InboundApplicationItem) => {
    if (!session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/inbound-applications/${item.id}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (res.ok) {
        setSuccessBanner(`Inbound application ${item.id.slice(0, 8)} marked for retry.`);
        fetchItems();
        setTimeout(() => setSuccessBanner(null), 4000);
      }
    } catch {
      // ignore
    }
  };

  const handleExecuteIgnore = async () => {
    if (!ignoreTarget || !ignoreReason.trim() || !session?.access_token) return;
    setIgnoreLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/inbound-applications/${ignoreTarget.id}/ignore`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: ignoreReason.trim() }),
      });

      if (res.ok) {
        setSuccessBanner(`Inbound application marked as ignored.`);
        setIgnoreTarget(null);
        setIgnoreReason('');
        fetchItems();
        setTimeout(() => setSuccessBanner(null), 4000);
      }
    } catch {
      // ignore
    } finally {
      setIgnoreLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <Inbox size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem' }} />
        <h2 style={{ marginBottom: '0.5rem' }}>Authentication Required</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Please sign in with authorized agency credentials to view the inbound applications queue.
        </p>
      </div>
    );
  }

  if (profile.role === UserRole.CLIENT) {
    return (
      <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
          <XCircle /> Restricted Access
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Client portal users are not authorized to view the raw platform inbound mailbox queue.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Inbox style={{ color: 'var(--primary)' }} /> Inbound Email Queue
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Multi-tenant inbound email monitor ({total} {total === 1 ? 'record' : 'records'}). Applications without valid Job Codes or requiring remediation are safely isolated here.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchItems} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={16} className={loading ? 'spin-icon' : ''} /> Refresh
        </button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--success)', color: 'var(--success)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={18} /> {successBanner}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              { label: 'All', value: '' },
              { label: 'Unmatched', value: InboundStatus.UNMATCHED },
              { label: 'Failed', value: InboundStatus.FAILED },
              { label: 'Matched', value: InboundStatus.MATCHED },
              { label: 'Duplicate', value: InboundStatus.DUPLICATE },
              { label: 'Ignored', value: InboundStatus.IGNORED },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`btn ${statusFilter === tab.value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
            <div className="search-box-wrapper" style={{ width: '250px' }}>
              <Search size={14} />
              <input
                type="text"
                className="input"
                placeholder="Search subject / sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', height: '38px' }}>
              Filter
            </button>
          </form>
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading && items.length === 0 ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '50%' }}>
                  <div className="skeleton" style={{ width: '60%', height: '14px' }} />
                  <div className="skeleton" style={{ width: '40%', height: '11px' }} />
                </div>
                <div className="skeleton" style={{ width: '80px', height: '24px' }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
            <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem' }} />
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Inbox size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--text-dim)' }} />
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>No Inbound Records</h3>
            <p style={{ fontSize: '0.85rem' }}>
              {statusFilter
                ? `No emails found matching status "${statusFilter}".`
                : 'No application emails have been ingested into this queue yet.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)' }}>Received</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)' }}>Sender & Subject</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)' }}>Job Code</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)' }}>Status</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)' }}>Remediation Reason</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-dim)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(item.receivedAt).toLocaleDateString()} {new Date(item.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.15rem' }}>
                        {item.subject}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {item.senderName ? `${item.senderName} <${item.senderEmail}>` : item.senderEmail}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      {item.extractedJobCode ? (
                        <span style={{ fontFamily: 'monospace', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 600 }}>
                          {item.extractedJobCode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', whiteSpace: 'nowrap' }}>
                      <span
                        className={`status-pill ${
                          item.status === InboundStatus.MATCHED
                            ? 'status-online'
                            : item.status === InboundStatus.DUPLICATE
                            ? 'status-online'
                            : item.status === InboundStatus.UNMATCHED
                            ? 'status-offline'
                            : item.status === InboundStatus.FAILED
                            ? 'status-offline'
                            : 'status-offline'
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {item.failureReason ? (
                        <code style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {item.failureReason}
                        </code>
                      ) : item.status === InboundStatus.MATCHED ? (
                        <span style={{ color: 'var(--success)' }}>Matched & Processed</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        {(item.status === InboundStatus.UNMATCHED || item.status === InboundStatus.FAILED) && (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => handleOpenAssignModal(item)}
                              title="Assign to a live Job"
                            >
                              <ArrowRight size={12} /> Assign Job
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => handleExecuteRetry(item)}
                              title="Retry processing"
                            >
                              <RefreshCw size={12} /> Retry
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}
                              onClick={() => {
                                setIgnoreTarget(item);
                                setIgnoreReason('');
                              }}
                              title="Ignore email"
                            >
                              <Slash size={12} />
                            </button>
                          </>
                        )}
                        {item.linkedApplicationId && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '4px' }}>
                            App #{item.linkedApplicationId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Job Assignment Modal */}
      {assignTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Manual Job Assignment</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Assign email <strong>&ldquo;{assignTarget.subject}&rdquo;</strong> to an active job. This will create or update the candidate and application in the selected job&apos;s pipeline.
            </p>

            {assignError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {assignError}
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                Select Active Job
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.9rem',
                }}
              >
                <option value="" style={{ background: '#1e293b' }}>-- Select Target Job --</option>
                {availableJobs.map((j) => (
                  <option key={j.id} value={j.id} style={{ background: '#1e293b' }}>
                    {j.jobCode} — {j.title} ({j.client?.name || 'Direct'})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAssignTarget(null)}
                disabled={assignLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteAssign}
                disabled={!selectedJobId || assignLoading}
              >
                {assignLoading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ignore Reason Modal */}
      {ignoreTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '1.75rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Ignore Inbound Email</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Please provide a reason for archiving/ignoring this message:
            </p>

            <input
              type="text"
              placeholder="e.g. Spam / Marketing newsletter"
              value={ignoreReason}
              onChange={(e) => setIgnoreReason(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                padding: '0.6rem 0.85rem',
                fontSize: '0.9rem',
                marginBottom: '1.25rem',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIgnoreTarget(null)}
                disabled={ignoreLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteIgnore}
                disabled={!ignoreReason.trim() || ignoreLoading}
              >
                {ignoreLoading ? 'Saving...' : 'Ignore Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
