import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Briefcase,
  MapPin,
  Building,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Upload,
  CheckCircle,
  FileText,
  Send,
} from 'lucide-react';
import { PublicJobDto } from '@hiredesk/shared';
import {
  fetchPublicCareerJobs,
  fetchPublicCareerJobByCode,
  submitPublicApplication,
  PublicApplyResult,
} from '../lib/api';

export function PublicCareerView() {
  const { orgSlug, jobCode } = useParams<{ orgSlug: string; jobCode?: string }>();

  const [orgName, setOrgName] = useState<string>('');
  const [jobs, setJobs] = useState<PublicJobDto[]>([]);
  const [selectedJob, setSelectedJob] = useState<PublicJobDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Application form state
  const [applicantName, setApplicantName] = useState<string>('');
  const [applicantEmail, setApplicantEmail] = useState<string>('');
  const [applicantPhone, setApplicantPhone] = useState<string>('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<PublicApplyResult | null>(null);

  useEffect(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError(null);
    setSubmissionResult(null);
    setFormError(null);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setResumeFile(null);
      return;
    }

    // Client-side file size check: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setFormError(`File size exceeds 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB). Please select a smaller file.`);
      setResumeFile(null);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'doc'].includes(ext)) {
      setFormError('Only PDF, DOCX, and DOC formats are supported.');
      setResumeFile(null);
      return;
    }

    setResumeFile(file);
  };

  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgSlug || !jobCode || !selectedJob) return;

    if (!resumeFile) {
      setFormError('Please upload your resume document before submitting.');
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('name', applicantName.trim());
      formData.append('email', applicantEmail.trim());
      formData.append('phone', applicantPhone.trim());
      formData.append('resume', resumeFile);
      if (honeypot) {
        formData.append('honeypot', honeypot);
      }

      const result = await submitPublicApplication(orgSlug, jobCode, formData);
      setSubmissionResult(result);
    } catch (err: any) {
      setFormError(err.message || 'Submission failed. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
        /* Single Job Detail & Application View */
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

            {/* Application Section */}
            <div id="apply-section" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
              {submissionResult ? (
                /* Success State */
                <div style={{ padding: '2rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                  <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 1rem auto' }} />
                  <h3 style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    {submissionResult.isDuplicate ? 'Application Already on File' : 'Application Successfully Submitted!'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '500px', margin: '0 auto 1.25rem auto', lineHeight: 1.6 }}>
                    {submissionResult.message}. Your candidate tracking reference is{' '}
                    <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{submissionResult.candidateCode}</strong>.
                    Our recruitment team will review your profile shortly.
                  </p>
                  <Link to={`/career/${orgSlug}`} className="btn btn-secondary">
                    Browse Other Open Roles
                  </Link>
                </div>
              ) : (
                /* Application Form */
                <div style={{ padding: '2rem', background: 'rgba(18, 24, 38, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>Apply for this Position</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Please provide your contact information and upload your resume.
                    </p>
                  </div>

                  {formError && (
                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <AlertCircle size={18} />
                      <span>{formError}</span>
                    </div>
                  )}

                  <form onSubmit={handleApplicationSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Bot Trap */}
                    <input
                      type="text"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      style={{ display: 'none' }}
                      tabIndex={-1}
                      autoComplete="off"
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Jane Doe"
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. jane.doe@example.com"
                          value={applicantEmail}
                          onChange={(e) => setApplicantEmail(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. +1 (555) 019-2834"
                        value={applicantPhone}
                        onChange={(e) => setApplicantPhone(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.85rem', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                        Resume Document * (PDF, DOCX, DOC &bull; Max 10 MB)
                      </label>
                      <div
                        style={{
                          border: '2px dashed var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.5rem',
                          textAlign: 'center',
                          background: 'rgba(255, 255, 255, 0.01)',
                          cursor: 'pointer',
                          transition: 'border-color 0.2s',
                        }}
                        onClick={() => document.getElementById('resume-file-input')?.click()}
                      >
                        <input
                          id="resume-file-input"
                          type="file"
                          accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          required
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        {resumeFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                            <FileText size={24} />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{resumeFile.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                                {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to change
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <Upload size={28} style={{ color: 'var(--primary)' }} />
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              Click or drag and drop to upload your resume
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              Accepted formats: PDF, DOCX, DOC (max 10 MB)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={submitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
                      >
                        {submitting ? (
                          <>
                            <RefreshCw className="pulse-dot" size={16} /> Submitting Application...
                          </>
                        ) : (
                          <>
                            <Send size={16} /> Submit Application
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
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
                View & Apply
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Expandable Applicant FAQ Section */}
      <section
        style={{
          marginTop: '2.5rem',
          padding: '1.5rem',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
        aria-labelledby="career-faq-title"
      >
        <h3 id="career-faq-title" style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Frequently Asked Questions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <details style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none', color: 'var(--text-main)' }}>
              Can I apply by email instead of using this web form?
            </summary>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Yes! You can email your resume directly to our agency's recruitment inbox. Include the exact Job Code (e.g. JOB-1001) in your email subject line, and our automated intake system will link your resume directly to this vacancy.
            </p>
          </details>

          <details style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none', color: 'var(--text-main)' }}>
              What file formats and sizes are supported for resumes?
            </summary>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              We accept PDF, DOCX, and DOC files up to 10 MB. Resumes are stored in private cloud storage and accessed only by authenticated recruiters.
            </p>
          </details>

          <details style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none', color: 'var(--text-main)' }}>
              What happens if I submit my application multiple times?
            </summary>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Our system utilizes idempotent deduplication. If you apply for the same vacancy with the same email, your existing application is safely preserved without creating duplicate records or re-uploading duplicate files.
            </p>
          </details>

          <details style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <summary style={{ fontWeight: 600, cursor: 'pointer', outline: 'none', color: 'var(--text-main)' }}>
              How will I be contacted for interviews?
            </summary>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Shortlisted candidates will receive interview invitations via email complete with calendar attachments (RFC 5545 .ics) and direct meeting links.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
