import fs from 'fs';

let file = fs.readFileSync('apps/web/src/pages/TalentPoolView.tsx', 'utf8');
file = file.replace(/\r\n/g, '\n');

// 1. Update state declarations
const targetState = `  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);`;

const replState = `  const [currentPage, setCurrentPage] = useState<number>(1);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);`;

if (!file.includes(targetState)) {
  console.error('targetState not found!');
  process.exit(1);
}
file = file.replace(targetState, replState);

// 2. Update loadCandidates
const targetLoad = `  // Load Candidates
  const loadCandidates = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const query: TalentPoolQuery = {
        page: currentPage,
        limit: 15,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (debouncedSkills.trim()) query.skills = debouncedSkills.trim();
      if (selectedStage) query.stage = selectedStage;
      if (selectedFolderId) query.folderId = selectedFolderId;
      if (debouncedLocation.trim()) query.location = debouncedLocation.trim();

      const result = await fetchTalentPoolCandidates(token, query);
      setCandidates(result.candidates);
      setTotalCandidates(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load candidates from talent pool');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, debouncedSearch, debouncedSkills, selectedStage, selectedFolderId, debouncedLocation, sortBy, sortOrder]);`;

const replLoad = `  // Load Candidates
  const loadCandidates = useCallback(async () => {
    if (!token) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (candidates.length === 0) {
      setInitialLoading(true);
    } else {
      setIsFiltering(true);
    }
    setError(null);

    try {
      const query: TalentPoolQuery = {
        page: currentPage,
        limit: 15,
        sortBy,
        sortOrder,
      };

      if (debouncedSearch.trim()) query.search = debouncedSearch.trim();
      if (debouncedSkills.trim()) query.skills = debouncedSkills.trim();
      if (selectedStage) query.stage = selectedStage;
      if (selectedFolderId) query.folderId = selectedFolderId;
      if (debouncedLocation.trim()) query.location = debouncedLocation.trim();

      const result = await fetchTalentPoolCandidates(token, query, controller.signal);
      setCandidates(result.candidates);
      setTotalCandidates(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to load candidates from talent pool');
    } finally {
      setInitialLoading(false);
      setIsFiltering(false);
    }
  }, [token, currentPage, debouncedSearch, debouncedSkills, selectedStage, selectedFolderId, debouncedLocation, sortBy, sortOrder, candidates.length]);`;

if (!file.includes(targetLoad)) {
  console.error('targetLoad not found!');
  process.exit(1);
}
file = file.replace(targetLoad, replLoad);

// 3. Update filter actions and spinner
const targetButtons = `          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(searchTerm || skillsTerm || selectedStage || selectedFolderId || locationTerm) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}

            <button
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={loadCandidates}
              title="Refresh candidate list"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>`;

const replButtons = `          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isFiltering && (
              <span style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
                <RefreshCw size={12} className="spin" /> Updating...
              </span>
            )}
            {(searchTerm || skillsTerm || selectedStage || selectedFolderId || locationTerm) && (
              <button
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                onClick={resetFilters}
              >
                Clear Filters
              </button>
            )}

            <button
              className="btn btn-secondary"
              style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              onClick={loadCandidates}
              title="Refresh candidate list"
            >
              <RefreshCw size={13} className={isFiltering ? 'spin' : ''} /> Refresh
            </button>
          </div>`;

if (!file.includes(targetButtons)) {
  console.error('targetButtons not found!');
  process.exit(1);
}
file = file.replace(targetButtons, replButtons);

// 4. Update candidate list container
const targetList = `      {/* Candidates List / Table */}
      {loading && candidates.length === 0 ? (`;

const replList = `      {/* Candidates List / Table */}
      {initialLoading && candidates.length === 0 ? (`;

if (!file.includes(targetList)) {
  console.error('targetList not found!');
  process.exit(1);
}
file = file.replace(targetList, replList);

const targetRender = `      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {candidates.map((candidate) => (`;

const replRender = `      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', opacity: isFiltering ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
          {candidates.map((candidate) => (`;

if (!file.includes(targetRender)) {
  console.error('targetRender not found!');
  process.exit(1);
}
file = file.replace(targetRender, replRender);

fs.writeFileSync('apps/web/src/pages/TalentPoolView.tsx', file, 'utf8');
console.log('Successfully updated TalentPoolView.tsx!');
