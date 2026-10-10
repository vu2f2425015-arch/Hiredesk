import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  Plus,
  Search,
  Copy,
  Check,
  Layers,
  Building,
  MapPin,
  AlertCircle,
  RefreshCw,
  X,
  Download,
  User,
} from 'lucide-react';
import {
  ApiJob,
  ClientOption,
  fetchJobs,
  createJob,
  publishJob,
  closeJob,
  reopenJob,
  duplicateJob,
  fetchClientsForOrg,
  fetchJobApplications,
  fetchResumeDownloadUrl,
  ApplicationItem,
} from '../lib/api';
import { EmploymentType, JobStatus, WorkplaceModel, UserRole } from '@hiredesk/shared';
import { JobPipelineView } from './JobPipelineView';
import { CandidateProfileModal } from './CandidateProfileModal';

export function JobsView() {
  const { session, profile } = useAuth();
  const token = session?.access_token;

  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<ApiJob | null>(null);
  const [pipelineJob, setPipelineJob] = useState<ApiJob | null>(null);
  const [activeProfileCandidateId, setActiveProfileCandidateId] = useState<string | null>(null);

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobs(token, {
        search: search || undefined,
        status: (statusFilter as JobStatus) || undefined,
      });
      setJobs(res.jobs);
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [token, search, statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (token && profile?.organizationId) {
      fetchClientsForOrg(token, profile.organizationId).then(setClients).catch(() => setClients([]));
    }
  }, [token, profile?.organizationId]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePublish = async (id: string) => {
    if (!token) return;
    try {
      const updated = await publishJob(token, id);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      if (selectedJob?.id === id) setSelectedJob(updated);
      setActionSuccessMessage(`Job ${updated.jobCode} published successfully`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    }
  };

  const handleClose = async (id: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to close this job vacancy?')) return;
    try {
      const updated = await closeJob(token, id);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      if (selectedJob?.id === id) setSelectedJob(updated);
      setActionSuccessMessage(`Job ${updated.jobCode} closed`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Close failed: ${err.message}`);
    }
  };

  const handleReopen = async (id: string) => {
    if (!token) return;
    try {
      const updated = await reopenJob(token, id);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
      if (selectedJob?.id === id) setSelectedJob(updated);
      setActionSuccessMessage(`Job ${updated.jobCode} reopened to published`);
      setTimeout(() => setActionSuccessMessage(null), 3000);
    } catch (err: any) {
      alert(`Reopen failed: ${err.message}`);
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!token) return;
    try {
      const duplicated = await duplicateJob(token, id);
      setJobs((prev) => [duplicated, ...prev]);
      setActionSuccessMessage(`Job duplicated with new atomic code ${duplicated.jobCode}`);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const canCreate = profile && [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER].includes(profile.role);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase style={{ color: 'var(--primary)' }} /> Job Vacancies
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Manage agency recruitment pipelines, allocate atomic Job Codes, and distribute to job boards.
          </p>
        </div>

        {canCreate && (
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Create Job
          </button>
        )}
      </div>

      {actionSuccessMessage && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Check size={16} /> {actionSuccessMessage}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px', background: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Search size={16} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Search by job title, department, or JOB-1001..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', width: '100%', outline: 'none', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>

          <button className="btn btn-secondary" onClick={loadJobs} title="Refresh jobs">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {pipelineJob ? (
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <JobPipelineView jobId={pipelineJob.id} onClose={() => setPipelineJob(null)} />
        </div>
      ) : loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading persisted jobs from server...</p>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 0.5rem auto' }} />
          <p>{error}</p>
          <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={loadJobs}>
            Retry
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <Briefcase className="empty-icon" size={48} />
          <h2 className="empty-title">No Job Openings Found</h2>
          <p className="empty-desc">
            {search || statusFilter
              ? 'No jobs match your current search or filter criteria.'
              : 'Your agency has not created any job vacancies yet. Click "Create Job" to generate your first vacancy with an atomic Job Code.'}
          </p>
          {canCreate && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Create Job Opening
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {jobs.map((job) => (
            <div key={job.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: 'var(--primary)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                      }}
                    >
                      {job.jobCode}
                    </span>
                    <button
                      onClick={() => handleCopyCode(job.jobCode)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedCode === job.jobCode ? 'var(--success)' : 'var(--text-dim)' }}
                      title="Copy Job Code"
                    >
                      {copiedCode === job.jobCode ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  <span
                    className={`status-pill ${
                      job.status === 'published' ? 'status-online' : job.status === 'draft' ? '' : 'status-offline'
                    }`}
                    style={
                      job.status === 'draft'
                        ? { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }
                        : {}
                    }
                  >
                    {job.status.toUpperCase()}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{job.title}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                  {job.client && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-cyan)' }}>
                      <Building size={14} /> {job.client.name}
                    </span>
                  )}
                  {job.department && <span>&bull; {job.department}</span>}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '1rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={13} /> {job.workplaceModel} ({job.country})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Briefcase size={13} /> {job.employmentType}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Layers size={13} /> {job.openings} opening{job.openings > 1 ? 's' : ''}
                  </span>
                </div>

                {job.salaryMin && job.salaryMax && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Compensation: <strong>{job.currency} {job.salaryMin.toLocaleString()} - {job.salaryMax.toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Applicants: <strong style={{ color: 'var(--text-main)' }}>{job.applicantCount}</strong>
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--primary)', borderColor: 'rgba(99, 102, 241, 0.4)' }}
                    onClick={() => setPipelineJob(job)}
                  >
                    <Layers size={13} style={{ marginRight: '0.25rem' }} /> Pipeline
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={() => setSelectedJob(job)}>
                    Details
                  </button>

                  {canCreate && (
                    <>
                      {job.status === 'draft' && (
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }} onClick={() => handlePublish(job.id)}>
                          Publish
                        </button>
                      )}
                      {job.status === 'published' && (
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleClose(job.id)}>
                          Close
                        </button>
                      )}
                      {job.status === 'closed' && (
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: 'var(--success)' }} onClick={() => handleReopen(job.id)}>
                          Reopen
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Job Modal */}
      {isCreateOpen && (
        <CreateJobModal
          clients={clients}
          onClose={() => setIsCreateOpen(false)}
          onCreated={(newJob) => {
            setIsCreateOpen(false);
            setJobs((prev) => [newJob, ...prev]);
            setActionSuccessMessage(`Job created! Allocated permanent Job Code: ${newJob.jobCode}`);
          }}
        />
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onDuplicate={canCreate ? () => handleDuplicate(selectedJob.id) : undefined}
          onPublish={canCreate && selectedJob.status === 'draft' ? () => handlePublish(selectedJob.id) : undefined}
          onCloseJob={canCreate && selectedJob.status === 'published' ? () => handleClose(selectedJob.id) : undefined}
          onOpenCandidateProfile={(candidateId) => setActiveProfileCandidateId(candidateId)}
        />
      )}

      {/* Candidate Profile Modal */}
      {activeProfileCandidateId && (
        <CandidateProfileModal
          candidateId={activeProfileCandidateId}
          onClose={() => setActiveProfileCandidateId(null)}
          onApplicationUpdated={loadJobs}
        />
      )}
    </div>
  );
}

function CreateJobModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: ClientOption[];
  onClose: () => void;
  onCreated: (job: ApiJob) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [department, setDepartment] = useState('');
  const [employmentType, setEmploymentType] = useState<EmploymentType>(EmploymentType.FULL_TIME);
  const [workplaceModel, setWorkplaceModel] = useState<WorkplaceModel>(WorkplaceModel.REMOTE);
  const [country, setCountry] = useState('United States');
  const [currency, setCurrency] = useState('USD');
  const [salaryMin, setSalaryMin] = useState<string>('');
  const [salaryMax, setSalaryMax] = useState<string>('');
  const [experienceYears, setExperienceYears] = useState<number>(2);
  const [openings, setOpenings] = useState<number>(1);
  const [skillsStr, setSkillsStr] = useState('TypeScript, Node.js, React');
  const [description, setDescription] = useState('We are looking for an experienced developer to join our team.');
  const [requirements, setRequirements] = useState('');
  const [status, setStatus] = useState<JobStatus>(JobStatus.DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setError('Minimum salary cannot exceed maximum salary');
      return;
    }

    if (!clientId) {
      setError('Please select or specify a target client company');
      return;
    }

    setSubmitting(true);
    try {
      const skills = skillsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const created = await createJob(token, {
        clientId,
        title,
        department: department || undefined,
        employmentType,
        workplaceModel,
        country,
        currency,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        experienceYears: Number(experienceYears),
        openings: Number(openings),
        skills,
        description,
        requirements: requirements || undefined,
        status,
      });

      onCreated(created);
    } catch (err: any) {
      setError(err.message || 'Job creation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card" style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <h3>Create New Job Vacancy</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Job Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer"
              style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Client Company *</label>
              {clients.length > 0 ? (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  placeholder="Client UUID"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
                />
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              >
                <option value={EmploymentType.FULL_TIME}>Full Time</option>
                <option value={EmploymentType.PART_TIME}>Part Time</option>
                <option value={EmploymentType.CONTRACT}>Contract</option>
                <option value={EmploymentType.INTERNSHIP}>Internship</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Workplace Model</label>
              <select
                value={workplaceModel}
                onChange={(e) => setWorkplaceModel(e.target.value as WorkplaceModel)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              >
                <option value={WorkplaceModel.REMOTE}>Remote</option>
                <option value={WorkplaceModel.HYBRID}>Hybrid</option>
                <option value={WorkplaceModel.ON_SITE}>On Site</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Country *</label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JobStatus)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              >
                <option value={JobStatus.DRAFT}>Draft</option>
                <option value={JobStatus.PUBLISHED}>Published (Live)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Min Salary</label>
              <input
                type="number"
                placeholder="70000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Max Salary</label>
              <input
                type="number"
                placeholder="95000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Currency</label>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Experience (Years)</label>
              <input
                type="number"
                min="0"
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Openings</label>
              <input
                type="number"
                min="1"
                value={openings}
                onChange={(e) => setOpenings(Number(e.target.value))}
                style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Skills (comma-separated)</label>
            <input
              type="text"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Job Description * (min 20 chars)</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>Key Requirements</label>
            <textarea
              rows={3}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Specific degrees, certifications, or tech proficiencies..."
              style={{ width: '100%', padding: '0.6rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Allocating Code...' : 'Create Vacancy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JobDetailModal({
  job,
  onClose,
  onDuplicate,
  onPublish,
  onCloseJob,
  onOpenCandidateProfile,
}: {
  job: ApiJob;
  onClose: () => void;
  onDuplicate?: () => void;
  onPublish?: () => void;
  onCloseJob?: () => void;
  onOpenCandidateProfile?: (candidateId: string) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [activeTab, setActiveTab] = useState<'details' | 'pipeline' | 'applicants'>('details');
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loadingApps, setLoadingApps] = useState<boolean>(false);
  const [appsLoaded, setAppsLoaded] = useState<boolean>(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (token && job.id && activeTab === 'applicants' && !appsLoaded) {
      setLoadingApps(true);
      fetchJobApplications(token, job.id)
        .then((res) => {
          setApplications(res.applications);
          setAppsLoaded(true);
        })
        .catch((err) => console.error('Failed to load applications:', err))
        .finally(() => setLoadingApps(false));
    }
  }, [token, job.id, activeTab, appsLoaded]);

  const handleDownloadResume = async (applicationId: string) => {
    if (!token) return;
    setDownloadingId(applicationId);
    try {
      const { signedUrl } = await fetchResumeDownloadUrl(token, applicationId);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-card" style={{ maxWidth: activeTab === 'pipeline' ? '1200px' : '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', transition: 'max-width 0.2s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                {job.jobCode}
              </span>
              <span className={`status-pill ${job.status === 'published' ? 'status-online' : 'status-offline'}`}>
                {job.status.toUpperCase()}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem' }}>{job.title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
          <button
            onClick={() => setActiveTab('details')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'details' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'details' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Job Details
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'pipeline' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'pipeline' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Layers size={14} />
            <span>Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('applicants')}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'applicants' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'applicants' ? 'var(--primary)' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>Applicants</span>
            <span style={{ background: 'rgba(99,102,241,0.2)', padding: '0.1rem 0.45rem', borderRadius: '10px', fontSize: '0.75rem' }}>
              {job.applicantCount}
            </span>
          </button>
        </div>

        {activeTab === 'pipeline' ? (
          <div style={{ marginBottom: '1.5rem' }}>
            <JobPipelineView jobId={job.id} />
          </div>
        ) : activeTab === 'details' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Client Company</span>
                <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{job.client?.name || 'Internal'}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Department</span>
                <div style={{ fontWeight: 600 }}>{job.department || 'Not specified'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Model</span>
                <div style={{ fontWeight: 600 }}>{job.workplaceModel}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Type</span>
                <div style={{ fontWeight: 600 }}>{job.employmentType}</div>
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Openings</span>
                <div style={{ fontWeight: 600 }}>{job.openings}</div>
              </div>
            </div>

            {job.skills && job.skills.length > 0 && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                  Required Skills
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {job.skills.map((s, i) => (
                    <span key={i} style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                Description
              </span>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{job.description}</p>
            </div>

            <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                Created: {new Date(job.createdAt).toLocaleDateString()} &bull; Total Candidates: <strong>{job.applicantCount}</strong>
              </span>
            </div>
          </div>
        ) : (
          /* Applicants Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {loadingApps ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                <RefreshCw className="pulse-dot" style={{ margin: '0 auto 0.5rem auto' }} />
                <p>Loading applicants...</p>
              </div>
            ) : applications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }}>
                <User size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 0.5rem auto' }} />
                <h4>No Applications Received Yet</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  Candidates who apply through the public career page will appear here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {applications.map((app) => (
                  <div
                    key={app.id}
                    style={{
                      padding: '1rem',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div
                      style={{ cursor: 'pointer', flex: 1 }}
                      onClick={() => onOpenCandidateProfile?.(app.candidate.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary)', background: 'rgba(99,102,241,0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {app.candidate.candidateCode}
                        </span>
                        <span className="status-pill status-online" style={{ fontSize: '0.7rem' }}>
                          {app.stage}
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                          Applied {new Date(app.appliedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{app.candidate.name}</h4>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem' }}>
                        <span>{app.candidate.email}</span>
                        {app.candidate.phone && <span>&bull; {app.candidate.phone}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                        onClick={() => onOpenCandidateProfile?.(app.candidate.id)}
                      >
                        <User size={13} /> Profile
                      </button>

                      {app.resumes && app.resumes.length > 0 ? (
                        <button
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                          onClick={() => handleDownloadResume(app.id)}
                          disabled={downloadingId === app.id}
                        >
                          {downloadingId === app.id ? (
                            <RefreshCw className="pulse-dot" size={14} />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>Resume</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>No resume</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {onDuplicate && (
              <button className="btn btn-secondary" onClick={onDuplicate}>
                Duplicate Job
              </button>
            )}
            {onPublish && (
              <button className="btn btn-primary" onClick={onPublish}>
                Publish Job
              </button>
            )}
            {onCloseJob && (
              <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={onCloseJob}>
                Close Job
              </button>
            )}
          </div>

          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
