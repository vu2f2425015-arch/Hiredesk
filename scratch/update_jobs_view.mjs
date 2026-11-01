import fs from 'fs';

let file = fs.readFileSync('apps/web/src/pages/JobsView.tsx', 'utf8');
file = file.replace(/\r\n/g, '\n');

const target1 = `  const loadJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJobs(token, {
        search: debouncedSearch || undefined,
        status: (statusFilter as JobStatus) || undefined,
      });
      setJobs(res.jobs);
      if (jobsCacheKey) {
        try {
          sessionStorage.setItem(jobsCacheKey, JSON.stringify(res.jobs));
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, statusFilter, jobsCacheKey]);`;

const repl1 = `  const displayedJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter && job.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchTitle = job.title?.toLowerCase().includes(q);
        const matchCode = job.jobCode?.toLowerCase().includes(q);
        const matchDept = job.department?.toLowerCase().includes(q);
        const matchSkills = job.skills?.some((s) => s.toLowerCase().includes(q));
        if (!matchTitle && !matchCode && !matchDept && !matchSkills) return false;
      }
      return true;
    });
  }, [jobs, statusFilter, search]);

  const loadJobs = useCallback(async (isManual = false) => {
    if (!token) return;
    if (isManual || jobs.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetchJobs(token, { limit: 100 });
      setJobs(res.jobs);
      if (jobsCacheKey) {
        try {
          sessionStorage.setItem(jobsCacheKey, JSON.stringify(res.jobs));
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [token, jobsCacheKey, jobs.length]);`;

if (!file.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
file = file.replace(target1, repl1);

const target2 = `      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Briefcase size={26} />
          </div>
          <h2 className="empty-title">No Job Openings Found</h2>
          <p className="empty-desc">
            {search || statusFilter
              ? 'No jobs match your current search or filter criteria.'
              : 'Your agency has not created any job vacancies yet. Click "Create Job" to generate your first vacancy with an atomic Job Code.'}
          </p>
          {canCreate && (
            <button className="button-primary" onClick={() => setIsCreateOpen(true)} style={{ margin: '0 auto' }}>
              <Plus size={16} /> Create Job Opening
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {jobs.map((job) => (`;

const repl2 = `      ) : displayedJobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Briefcase size={26} />
          </div>
          <h2 className="empty-title">
            {jobs.length === 0 ? 'No Job Openings Found' : 'No Matching Jobs Found'}
          </h2>
          <p className="empty-desc">
            {jobs.length === 0
              ? 'Your agency has not created any job vacancies yet. Click "Create Job" to generate your first vacancy with an atomic Job Code.'
              : 'No job openings match your current search or filter criteria. Try adjusting your filters or resetting them.'}
          </p>
          {jobs.length > 0 ? (
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setStatusFilter(''); }} style={{ margin: '0 auto' }}>
              Reset Filters
            </button>
          ) : canCreate ? (
            <button className="button-primary" onClick={() => setIsCreateOpen(true)} style={{ margin: '0 auto' }}>
              <Plus size={16} /> Create Job Opening
            </button>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {displayedJobs.map((job) => (`;

if (!file.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
file = file.replace(target2, repl2);

file = file.replace('onClick={loadJobs}', 'onClick={() => void loadJobs(true)}');

fs.writeFileSync('apps/web/src/pages/JobsView.tsx', file, 'utf8');
console.log('Successfully updated JobsView.tsx!');
