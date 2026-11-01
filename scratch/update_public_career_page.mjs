import fs from 'fs';

const filePath = 'apps/web/src/pages/PublicCareerView.tsx';
let file = fs.readFileSync(filePath, 'utf8');

// Find the return statement
const returnIdx = file.indexOf('  return (\n    <div style={{ maxWidth:');
if (returnIdx === -1) {
  // Try CRLF
  const returnIdxCRLF = file.indexOf('  return (\r\n    <div style={{ maxWidth:');
  if (returnIdxCRLF === -1) {
    console.error('Return statement not found!');
    process.exit(1);
  }
}

const beforeReturn = file.slice(0, file.indexOf('  return ('));

const newReturn = `  return (
    <div className="career-container">
      {/* Career Banner */}
      <header className="career-hero-card">
        <div className="career-org-icon">
          <Building size={28} />
        </div>
        <h1 className="career-hero-title">{orgName || 'Career Opportunities'}</h1>
        <p className="career-hero-subtitle">
          Explore open vacancies and join our expanding team
        </p>
      </header>

      {loading ? (
        <div className="career-job-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <RefreshCw className="pulse-dot" style={{ margin: '0 auto 1rem auto' }} size={24} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Loading career opportunities...</p>
        </div>
      ) : error ? (
        <div className="career-job-card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--danger)' }}>
          <AlertCircle size={36} style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontWeight: 600 }}>{error}</p>
        </div>
      ) : selectedJob ? (
        /* Single Job Detail & Application View */
        <article className="career-job-card">
          <Link to={\`/career/\${orgSlug}\`} className="career-back-btn">
            <ArrowLeft size={16} /> Back to all open roles
          </Link>

          <div className="career-job-header">
            <div>
              <span className="career-code-pill">
                {selectedJob.jobCode}
              </span>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.65rem 0 0.25rem 0', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                {selectedJob.title}
              </h2>
              <div className="career-meta-row">
                <span className="career-meta-item">
                  <Building size={14} /> {selectedJob.department || 'General'}
                </span>
                <span>&bull;</span>
                <span className="career-meta-item">
                  <MapPin size={14} /> {selectedJob.workplaceModel} ({selectedJob.country})
                </span>
                <span>&bull;</span>
                <span className="career-meta-item">
                  <Briefcase size={14} /> {selectedJob.employmentType.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <div>
              <h4 className="career-section-title">About the Role</h4>
              <p style={{ color: 'var(--text-main)', lineHeight: 1.75, whiteSpace: 'pre-line', margin: 0, fontSize: '0.95rem' }}>
                {selectedJob.description}
              </p>
            </div>

            {selectedJob.requirements && (
              <div>
                <h4 className="career-section-title">Requirements</h4>
                <p style={{ color: 'var(--text-main)', lineHeight: 1.75, whiteSpace: 'pre-line', margin: 0, fontSize: '0.95rem' }}>
                  {selectedJob.requirements}
                </p>
              </div>
            )}

            {selectedJob.skills.length > 0 && (
              <div>
                <h4 className="career-section-title">Desired Skills</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedJob.skills.map((skill, i) => (
                    <span key={i} className="career-skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Application Section */}
            <div id="apply-section">
              {submissionResult ? (
                /* Success State */
                <div style={{ padding: '2.5rem 2rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: 'var(--radius-xl)', textAlign: 'center' }}>
                  <CheckCircle size={52} style={{ color: 'var(--success)', margin: '0 auto 1.25rem auto' }} />
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    {submissionResult.isDuplicate ? 'Application Already on File' : 'Application Successfully Submitted!'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', maxWidth: '520px', margin: '0 auto 1.5rem auto', lineHeight: 1.6 }}>
                    {submissionResult.message}. Your candidate tracking reference is{' '}
                    <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '1.1rem' }}>{submissionResult.candidateCode}</strong>.
                    Our recruitment team will review your profile shortly.
                  </p>
                  <Link to={\`/career/\${orgSlug}\`} className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                    Browse Other Open Roles
                  </Link>
                </div>
              ) : (
                /* Application Form Card */
                <section className="career-apply-card" aria-labelledby="apply-heading">
                  <div style={{ marginBottom: '1.75rem' }}>
                    <h3 id="apply-heading" className="form-title">Apply for this Position</h3>
                    <p className="form-subtitle">
                      Please provide your contact information and upload your resume.
                    </p>
                  </div>

                  {formError && (
                    <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }} role="alert">
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <label className="career-input-label" htmlFor="applicant-name">
                          Full Name <span style={{ color: 'var(--primary)' }}>*</span>
                        </label>
                        <input
                          id="applicant-name"
                          type="text"
                          required
                          placeholder="e.g. Jane Doe"
                          value={applicantName}
                          onChange={(e) => setApplicantName(e.target.value)}
                          className="career-input"
                        />
                      </div>

                      <div>
                        <label className="career-input-label" htmlFor="applicant-email">
                          Email Address <span style={{ color: 'var(--primary)' }}>*</span>
                        </label>
                        <input
                          id="applicant-email"
                          type="email"
                          required
                          placeholder="e.g. jane.doe@example.com"
                          value={applicantEmail}
                          onChange={(e) => setApplicantEmail(e.target.value)}
                          className="career-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="career-input-label" htmlFor="applicant-phone">
                        Phone Number <span style={{ color: 'var(--primary)' }}>*</span>
                      </label>
                      <input
                        id="applicant-phone"
                        type="tel"
                        required
                        placeholder="e.g. +1 (555) 019-2834"
                        value={applicantPhone}
                        onChange={(e) => setApplicantPhone(e.target.value)}
                        className="career-input"
                      />
                    </div>

                    <div>
                      <label className="career-input-label">
                        Resume Document <span style={{ color: 'var(--primary)' }}>*</span> (PDF, DOCX, DOC &bull; Max 10 MB)
                      </label>
                      <div
                        className="career-dropzone"
                        onClick={() => document.getElementById('resume-file-input')?.click()}
                      >
                        <input
                          id="resume-file-input"
                          type="file"
                          accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          required={!resumeFile}
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />
                        {resumeFile ? (
                          <div className="career-file-preview">
                            <FileText size={26} style={{ color: 'var(--primary)' }} />
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.925rem', color: 'var(--text-main)' }}>{resumeFile.name}</div>
                              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click to choose another file
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div className="career-dropzone-icon">
                              <Upload size={22} />
                            </div>
                            <div className="career-dropzone-text">
                              Click or drag and drop to upload your resume
                            </div>
                            <div className="career-dropzone-subtext">
                              Accepted formats: PDF, DOCX, DOC (max 10 MB)
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        type="submit"
                        className="button-primary"
                        disabled={submitting}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontSize: '0.95rem' }}
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
                </section>
              )}
            </div>
          </div>
        </article>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Briefcase size={28} />
          </div>
          <h2 className="empty-title">No Open Positions</h2>
          <p className="empty-desc">There are currently no published openings available at this organization. Please check back later.</p>
        </div>
      ) : (
        /* Jobs List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {jobs.map((job) => (
            <div key={job.id} className="career-job-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem 1.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span className="career-code-pill">
                    {job.jobCode}
                  </span>
                  {job.department && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>&bull; {job.department}</span>}
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-main)' }}>{job.title}</h3>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={14} /> {job.workplaceModel} ({job.country})
                  </span>
                  <span>&bull;</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Briefcase size={14} /> {job.employmentType.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <Link to={\`/career/\${orgSlug}/\${job.jobCode}\`} className="button-primary" style={{ padding: '0.55rem 1.25rem', fontSize: '0.875rem' }}>
                View & Apply
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Expandable Applicant FAQ Section */}
      <section className="career-faq-box" aria-labelledby="career-faq-title">
        <h3 id="career-faq-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1.25rem 0', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Frequently Asked Questions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <details className="career-faq-item">
            <summary className="career-faq-summary">
              Can I apply by email instead of using this web form?
            </summary>
            <p style={{ marginTop: '0.65rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0.65rem 0 0 0' }}>
              Yes! You can email your resume directly to our agency's recruitment inbox. Include the exact Job Code (e.g. {jobCode || 'JOB-1030'}) in your email subject line, and our automated intake system will link your resume directly to this vacancy.
            </p>
          </details>

          <details className="career-faq-item">
            <summary className="career-faq-summary">
              What file formats and sizes are supported for resumes?
            </summary>
            <p style={{ marginTop: '0.65rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0.65rem 0 0 0' }}>
              We accept PDF, DOCX, and DOC files up to 10 MB. Resumes are stored in private cloud storage and accessed only by authenticated recruiters.
            </p>
          </details>

          <details className="career-faq-item">
            <summary className="career-faq-summary">
              What happens if I submit my application multiple times?
            </summary>
            <p style={{ marginTop: '0.65rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0.65rem 0 0 0' }}>
              Our system utilizes idempotent deduplication. If you apply for the same vacancy with the same email, your existing application is safely preserved without creating duplicate records or re-uploading duplicate files.
            </p>
          </details>

          <details className="career-faq-item">
            <summary className="career-faq-summary">
              How will I be contacted for interviews?
            </summary>
            <p style={{ marginTop: '0.65rem', fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0.65rem 0 0 0' }}>
              Shortlisted candidates will receive interview invitations via email complete with calendar attachments (RFC 5545 .ics) and direct meeting links.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
`;

fs.writeFileSync(filePath, beforeReturn + newReturn, 'utf8');
console.log('Successfully updated PublicCareerView.tsx with beautiful theme-adaptive UI!');

