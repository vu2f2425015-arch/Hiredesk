import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  PieChart,
  Award,
  Briefcase,
  Filter,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchFunnelReport,
  fetchTimeToHireReport,
  fetchCandidateSourcesReport,
  fetchRecruiterProductivityReport,
  fetchJobOutcomesReport,
  fetchJobs,
  FunnelReportData,
  TimeToHireReportData,
  CandidateSourceReportData,
  RecruiterProductivityReportData,
  JobOutcomesReportData,
  ApiJob,
} from '../lib/api';

type ReportTab = 'funnel' | 'time_to_hire' | 'sources' | 'productivity' | 'job_outcomes';

export function ReportsView() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [activeTab, setActiveTab] = useState<ReportTab>('funnel');
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Report datasets
  const [funnelData, setFunnelData] = useState<FunnelReportData | null>(null);
  const [timeToHireData, setTimeToHireData] = useState<TimeToHireReportData | null>(null);
  const [sourcesData, setSourcesData] = useState<CandidateSourceReportData | null>(null);
  const [productivityData, setProductivityData] = useState<RecruiterProductivityReportData | null>(null);
  const [jobOutcomesData, setJobOutcomesData] = useState<JobOutcomesReportData | null>(null);

  // Load available jobs for filter
  useEffect(() => {
    if (!token) return;
    fetchJobs(token)
      .then((res) => setJobs(res.jobs || []))
      .catch((err) => console.error('Failed to load jobs filter', err));
  }, [token]);

  // Load active report
  const loadActiveReport = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const query: any = {};
    if (selectedJobId) query.jobId = selectedJobId;
    if (startDate) query.startDate = startDate;
    if (endDate) query.endDate = endDate;

    try {
      if (activeTab === 'funnel') {
        const data = await fetchFunnelReport(token, query);
        setFunnelData(data);
      } else if (activeTab === 'time_to_hire') {
        const data = await fetchTimeToHireReport(token, query);
        setTimeToHireData(data);
      } else if (activeTab === 'sources') {
        const data = await fetchCandidateSourcesReport(token, query);
        setSourcesData(data);
      } else if (activeTab === 'productivity') {
        const data = await fetchRecruiterProductivityReport(token, { startDate, endDate });
        setProductivityData(data);
      } else if (activeTab === 'job_outcomes') {
        const data = await fetchJobOutcomesReport(token, { jobId: selectedJobId });
        setJobOutcomesData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveReport();
  }, [activeTab, selectedJobId, startDate, endDate, token]);

  return (
    <div className="page-container" style={{ padding: '2rem 2.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <TrendingUp size={28} color="var(--primary)" /> Advanced Analytics & Reports
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real database metrics, pipeline conversions, cycle times, and operational performance. Zero simulated metrics.
          </p>
        </div>

        <button
          onClick={loadActiveReport}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('funnel')}
          className={`btn ${activeTab === 'funnel' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <TrendingUp size={16} /> Funnel Conversion
        </button>
        <button
          onClick={() => setActiveTab('time_to_hire')}
          className={`btn ${activeTab === 'time_to_hire' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <Clock size={16} /> Time-to-Hire
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`btn ${activeTab === 'sources' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <PieChart size={16} /> Candidate Sources
        </button>
        <button
          onClick={() => setActiveTab('productivity')}
          className={`btn ${activeTab === 'productivity' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <Award size={16} /> Recruiter Productivity
        </button>
        <button
          onClick={() => setActiveTab('job_outcomes')}
          className={`btn ${activeTab === 'job_outcomes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
        >
          <Briefcase size={16} /> Job Outcomes
        </button>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '0.85rem 1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Filter size={14} /> Scope Filters:
        </div>

        {activeTab !== 'productivity' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Job:</label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="form-control"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem', width: '220px' }}
            >
              <option value="">All Jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.jobCode})
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab !== 'job_outcomes' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="form-control"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="form-control"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
              />
            </div>
          </>
        )}

        {(selectedJobId || startDate || endDate) && (
          <button
            onClick={() => {
              setSelectedJobId('');
              setStartDate('');
              setEndDate('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.82rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {(() => {
        const hasCurrentData = Boolean(
          (activeTab === 'funnel' && funnelData) ||
          (activeTab === 'time_to_hire' && timeToHireData) ||
          (activeTab === 'sources' && sourcesData) ||
          (activeTab === 'productivity' && productivityData) ||
          (activeTab === 'job_outcomes' && jobOutcomesData)
        );

        if (loading && !hasCurrentData) {
          return (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)' }}>
              <RefreshCw size={28} className="spin-icon" style={{ margin: '0 auto 1rem', display: 'block', color: 'var(--primary)' }} />
              <p style={{ margin: 0, fontWeight: 500 }}>Compiling database report aggregations...</p>
            </div>
          );
        }

        return (
          <>
          {/* TAB 1: FUNNEL REPORT */}
          {activeTab === 'funnel' && funnelData && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Applications</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    {funnelData.totalApplications}
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hired Candidates</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', color: '#10b981' }}>
                    {funnelData.stages.find((s) => s.stage === 'Hired')?.count || 0}
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Conversion Rate</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--primary)' }}>
                    {funnelData.stages.find((s) => s.stage === 'Hired')?.conversionFromApplied || 0}%
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '1.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                  Stage-by-Stage Conversion Funnel
                </h3>

                {funnelData.totalApplications === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No applications found matching the selected filters.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {funnelData.stages.map((stageMetric, idx) => {
                      const pct = stageMetric.conversionFromApplied;
                      return (
                        <div
                          key={stageMetric.stage}
                          style={{
                            padding: '1rem 1.25rem',
                            borderRadius: '8px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            boxShadow: 'var(--shadow-sm)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  background: 'rgba(99, 102, 241, 0.2)',
                                  color: 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{stageMetric.stage}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem' }}>
                              <span>
                                <strong>{stageMetric.count}</strong> applicants
                              </span>
                              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                {pct}% from top
                              </span>
                              {idx > 0 && (
                                <span style={{ color: 'var(--text-muted)' }}>
                                  ({stageMetric.conversionFromPrevious}% from previous)
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Visual Funnel Bar */}
                          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, pct))}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary) 0%, #3b82f6 100%)',
                                borderRadius: '4px',
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TIME TO HIRE */}
          {activeTab === 'time_to_hire' && timeToHireData && (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '1rem',
                  marginBottom: '2rem',
                }}
              >
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Hired Sample Size</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    {timeToHireData.totalHired}
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average Days to Hire</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--primary)' }}>
                    {timeToHireData.averageDaysToHire} days
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Median Days to Hire</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem' }}>
                    {timeToHireData.medianDaysToHire} days
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fastest Hire</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', color: '#10b981' }}>
                    {timeToHireData.fastestDaysToHire} days
                  </div>
                </div>
                <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Slowest Hire</span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.25rem', color: '#f59e0b' }}>
                    {timeToHireData.slowestDaysToHire} days
                  </div>
                </div>
              </div>

              {timeToHireData.totalHired === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Clock size={36} style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.3 }} />
                  <h4>No hires completed in this scope</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>
                    Time-to-hire metrics calculate duration from initial application to HIRED stage. Zero hires recorded yet.
                  </p>
                </div>
              ) : (
                <div className="card" style={{ padding: '1.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                    Average Days Spent Per Pipeline Stage
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {timeToHireData.stageAverages.map((sa) => (
                      <div
                        key={sa.stage}
                        style={{
                          padding: '1rem',
                          borderRadius: '8px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{sa.stage}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.25rem' }}>
                          {sa.averageDaysInStage} <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>days avg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SOURCES REPORT */}
          {activeTab === 'sources' && sourcesData && (
            <div>
              <div className="card" style={{ padding: '1.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                  Candidate Acquisition Channels & Conversion
                </h3>

                {sourcesData.sources.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No applicant source records found.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Source Channel</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Applicants</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Share of Total</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Hires</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Hire Conversion Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourcesData.sources.map((src) => {
                          const hireRate = src.count > 0 ? Math.round((src.hiredCount / src.count) * 1000) / 10 : 0;
                          return (
                            <tr key={src.source} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{src.source}</td>
                              <td style={{ padding: '0.85rem 1rem' }}>{src.count}</td>
                              <td style={{ padding: '0.85rem 1rem' }}>{src.percentage}%</td>
                              <td style={{ padding: '0.85rem 1rem', color: '#10b981', fontWeight: 600 }}>
                                {src.hiredCount}
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span
                                  style={{
                                    backgroundColor: hireRate > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                                    color: hireRate > 0 ? '#10b981' : 'var(--text-muted)',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  {hireRate}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: RECRUITER PRODUCTIVITY */}
          {activeTab === 'productivity' && productivityData && (
            <div>
              <div className="card" style={{ padding: '1.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                  Recruiter Operational Output (Audited Database Actions)
                </h3>

                {productivityData.recruiters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No recruiters or managers found in this organization.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Team Member</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Stage Transitions Moved</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Interviews Conducted</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Notes & Reviews Logged</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productivityData.recruiters.map((r) => (
                          <tr key={r.recruiterId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{r.recruiterName || 'Unnamed'}</td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{r.email}</td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                {r.stageTransitionsCount}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{ fontWeight: 600, color: '#10b981' }}>
                                {r.interviewsScheduledCount}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span>{r.notesLoggedCount}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: JOB OUTCOMES */}
          {activeTab === 'job_outcomes' && jobOutcomesData && (
            <div>
              <div className="card" style={{ padding: '1.75rem', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                  Per-Job Pipeline Outcomes & Yield
                </h3>

                {jobOutcomesData.jobs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No jobs found in scope.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <th style={{ padding: '0.75rem 1rem' }}>Job Title & Code</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Client</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Total Applicants</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Active in Pipeline</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Hired</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Rejected / Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobOutcomesData.jobs.map((job) => (
                          <tr key={job.jobId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 600 }}>{job.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{job.jobCode}</div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{job.clientName}</td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span className={`status-pill status-${job.status}`}>
                                {job.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{job.totalApplications}</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#3b82f6' }}>{job.activeCount}</td>
                            <td style={{ padding: '0.85rem 1rem', color: '#10b981', fontWeight: 600 }}>
                              {job.hiredCount}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#ef4444' }}>{job.rejectedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}
