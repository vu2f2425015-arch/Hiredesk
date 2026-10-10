import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Briefcase, MapPin, Building, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import { PublicJobDto } from '@hiredesk/shared';
import { fetchPublicCareerJobs, fetchPublicCareerJobByCode } from '../lib/api';

export function PublicCareerView() {
  const { orgSlug, jobCode } = useParams<{ orgSlug: string; jobCode?: string }>();

  const [orgName, setOrgName] = useState<string>('');
  const [jobs, setJobs] = useState<PublicJobDto[]>([]);
  const [selectedJob, setSelectedJob] = useState<PublicJobDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);

    if (jobCode) {
      // Single job detail view
      fetchPublicCareerJobByCode(orgSlug, jobCode)
        .then((j) => {
          setSelectedJob(j);
          setOrgName(j.organizationName);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      // Full career listings view
      fetchPublicCareerJobs(orgSlug)
        .then((res) => {
          setJobs(res.jobs);
          setOrgName(res.organization.name);
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [orgSlug, jobCode]);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Career Banner */}
      <div className="glass-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: 'linear-gradient(135deg, rgba(18,24,38,0.8) 0%, rgba(30,27,75,0.4) 100%)' }}>
        <Building style={{ color: 'var(--primary)', margin: '0 auto 0.75rem auto' }} size={36} />
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>{orgName || 'Career Opportunities'}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
          Explore open vacancies and join our expanding team
        </p>
      </div>

      {loading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading career opportunities...</p>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 0.5rem auto' }} />
          <p>{error}</p>
        </div>
      ) : selectedJob ? (
        /* Single Job Detail View */
        <div className="glass-card">
          <Link
            to={`/career/${orgSlug}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}
          >
            <ArrowLeft size={16} /> Back to all open roles
          </Link>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1.25rem' }}>
            <div>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', background: 'rgba(99,102,241,0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>
                {selectedJob.jobCode}
              </span>
              <h2 style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>{selectedJob.title}</h2>
              <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                <span>{selectedJob.department || 'General'}</span>
                <span>&bull;</span>
                <span>{selectedJob.workplaceModel} ({selectedJob.country})</span>
                <span>&bull;</span>
                <span>{selectedJob.employmentType}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>About the Role</h4>
              <p style={{ color: 'var(--text-main)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{selectedJob.description}</p>
            </div>

            {selectedJob.requirements && (
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Requirements</h4>
                <p style={{ color: 'var(--text-main)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{selectedJob.requirements}</p>
              </div>
            )}

            {selectedJob.skills.length > 0 && (
              <div>
                <h4 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Desired Skills</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedJob.skills.map((skill, i) => (
                    <span key={i} style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', padding: '0.25rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ padding: '1.25rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Ready to Apply?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                Online resume submission and public candidate application pipelines unlock in Phase 3.
              </p>
              <span className="status-pill status-offline">Apply Form: Phase 3 Next</span>
            </div>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <Briefcase className="empty-icon" size={48} />
          <h2 className="empty-title">No Open Positions</h2>
          <p className="empty-desc">There are currently no published openings available at this organization. Please check back later.</p>
        </div>
      ) : (
        /* Jobs List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => (
            <div key={job.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.85rem' }}>
                    {job.jobCode}
                  </span>
                  {job.department && <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>&bull; {job.department}</span>}
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{job.title}</h3>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <MapPin size={13} /> {job.workplaceModel} ({job.country})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Briefcase size={13} /> {job.employmentType}
                  </span>
                </div>
              </div>

              <Link to={`/career/${orgSlug}/${job.jobCode}`} className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                View Position
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
