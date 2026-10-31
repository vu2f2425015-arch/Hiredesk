import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  FolderPlus,
  Folder,
  Tag,
  Briefcase,
  ExternalLink,
  Plus,
  X,
  AlertCircle,
  RefreshCw,
  Clock,
  MapPin,
  Mail,
  Phone,
  Trash2,
  Edit2,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import {
  TalentPoolCandidate,
  TalentPoolFolder,
  TalentPoolQuery,
  fetchTalentPoolCandidates,
  fetchTalentPoolFolders,
  createTalentPoolFolder,
  updateTalentPoolFolder,
  deleteTalentPoolFolder,
  addCandidateToFolder,
  removeCandidateFromFolder,
  associateCandidateWithJob,
  fetchJobs,
  ApiJob,
} from '../lib/api';
import { ApplicationStage, UserRole, JobStatus } from '@hiredesk/shared';
import { CandidateProfileModal } from './CandidateProfileModal';

export function TalentPoolView() {
  const { session, profile } = useAuth();
  const token = session?.access_token;
  const isAuthorized = profile?.role && profile.role !== UserRole.CLIENT;

  // Data state
  const [candidates, setCandidates] = useState<TalentPoolCandidate[]>([]);
  const [folders, setFolders] = useState<TalentPoolFolder[]>([]);
  const [jobs, setJobs] = useState<ApiJob[]>([]);
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearch = useDebounce(searchTerm, 250);
  const [skillsTerm, setSkillsTerm] = useState<string>('');
  const debouncedSkills = useDebounce(skillsTerm, 250);
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [locationTerm, setLocationTerm] = useState<string>('');
  const debouncedLocation = useDebounce(locationTerm, 250);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'lastAppliedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState<boolean>(false);
  const [isEditFolderOpen, setIsEditFolderOpen] = useState<boolean>(false);
  const [folderToEdit, setFolderToEdit] = useState<TalentPoolFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState<string>('');
  const [folderDescInput, setFolderDescInput] = useState<string>('');
  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState<boolean>(false);

  // Add candidate to folder modal
  const [candidateForFolder, setCandidateForFolder] = useState<TalentPoolCandidate | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string>('');

  // Assign candidate to job modal
  const [candidateForJob, setCandidateForJob] = useState<TalentPoolCandidate | null>(null);
  const [targetJobId, setTargetJobId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assignSuccessMessage, setAssignSuccessMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [submittingAssign, setSubmittingAssign] = useState<boolean>(false);

  // Load Folders & Jobs
  const loadMetadata = useCallback(async () => {
    if (!token) return;
    try {
      const [foldersData, jobsData] = await Promise.all([
        fetchTalentPoolFolders(token),
        fetchJobs(token, { status: JobStatus.PUBLISHED, limit: 100 }),
      ]);
      setFolders(foldersData);
      setJobs(jobsData.jobs);
    } catch (err: any) {
      console.error('Failed to load talent pool metadata:', err);
    }
  }, [token]);

  // Load Candidates
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
  }, [token, currentPage, debouncedSearch, debouncedSkills, selectedStage, selectedFolderId, debouncedLocation, sortBy, sortOrder]);

  useEffect(() => {
    if (token && isAuthorized) {
      loadMetadata();
    }
  }, [token, isAuthorized, loadMetadata]);

  useEffect(() => {
    if (token && isAuthorized) {
      loadCandidates();
    }
  }, [token, isAuthorized, loadCandidates]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateFolderOpen) setIsCreateFolderOpen(false);
        if (isEditFolderOpen) setIsEditFolderOpen(false);
        if (candidateForFolder) setCandidateForFolder(null);
        if (candidateForJob) setCandidateForJob(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateFolderOpen, isEditFolderOpen, candidateForFolder, candidateForJob]);

  // Handlers for Folder operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !folderNameInput.trim() || isSubmittingFolder) return;
    setFolderActionError(null);
    setIsSubmittingFolder(true);
    try {
      const created = await createTalentPoolFolder(token, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
      setFolders((prev) => [...prev, created]);
      setFolderNameInput('');
      setFolderDescInput('');
      setIsCreateFolderOpen(false);
      await loadMetadata();
    } catch (err: any) {
      setFolderActionError(err.message || 'Failed to create folder');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !folderToEdit || !folderNameInput.trim() || isSubmittingFolder) return;
    setFolderActionError(null);
    setIsSubmittingFolder(true);
    try {
      const updated = await updateTalentPoolFolder(token, folderToEdit.id, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
      setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      setFolderToEdit(null);
      setIsEditFolderOpen(false);
      await loadMetadata();
    } catch (err: any) {
      setFolderActionError(err.message || 'Failed to update folder');
    } finally {
      setIsSubmittingFolder(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!token) return;
    if (!window.confirm(`Delete folder "${folderName}"? Candidates will not be deleted.`)) return;
    try {
      await deleteTalentPoolFolder(token, folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId('');
      }
      await loadMetadata();
      await loadCandidates();
    } catch (err: any) {
      alert(`Error deleting folder: ${err.message}`);
    }
  };

  const handleAddCandidateToFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !candidateForFolder || !targetFolderId) return;
    try {
      await addCandidateToFolder(token, targetFolderId, candidateForFolder.id);
      setCandidateForFolder(null);
      setTargetFolderId('');
      loadMetadata();
      loadCandidates();
    } catch (err: any) {
      alert(`Failed to add candidate to folder: ${err.message}`);
    }
  };

  const handleRemoveCandidateFromFolder = async (folderId: string, candidateId: string) => {
    if (!token) return;
    try {
      await removeCandidateFromFolder(token, folderId, candidateId);
      loadMetadata();
      loadCandidates();
    } catch (err: any) {
      alert(`Failed to remove candidate from folder: ${err.message}`);
    }
  };

  const handleAssignCandidateToJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !candidateForJob || !targetJobId) return;
    setSubmittingAssign(true);
    setAssignError(null);
    setAssignSuccessMessage(null);
    try {
      const res = await associateCandidateWithJob(token, candidateForJob.id, {
        jobId: targetJobId,
        source: 'talent_pool',
        recruiterNotes: assignNotes.trim() || undefined,
      });
      setAssignSuccessMessage(res.message);
      loadCandidates();
      setTimeout(() => {
        setCandidateForJob(null);
        setTargetJobId('');
        setAssignNotes('');
        setAssignSuccessMessage(null);
      }, 1500);
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign candidate to job');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSkillsTerm('');
    setSelectedStage('');
    setSelectedFolderId('');
    setLocationTerm('');
    setCurrentPage(1);
  };

  if (!isAuthorized) {
    return (
      <div className="glass-card" style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
        <AlertCircle size={40} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
        <h2>Access Restricted</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          The Talent Pool is reserved for agency recruiters and hiring managers. Client users access candidate profiles exclusively through the Client Portal.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', margin: 0, fontSize: '1.75rem' }}>
            <Users style={{ color: 'var(--primary)' }} />
            Talent Pool
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.35rem 0 0 0', fontSize: '0.9rem' }}>
            Multi-job candidate database, tag categorizations, and talent redeployment across vacancies.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            onClick={() => {
              setFolderNameInput('');
              setFolderDescInput('');
              setFolderActionError(null);
              setIsCreateFolderOpen(true);
            }}
          >
            <FolderPlus size={16} /> New Folder
          </button>
        </div>
      </div>

      {/* Folders Bar */}
      <div
        className="glass-card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Folders:
        </span>

        <button
          className={`btn ${selectedFolderId === '' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.825rem', borderRadius: 'var(--radius-full)' }}
          onClick={() => {
            setSelectedFolderId('');
            setCurrentPage(1);
          }}
        >
          All Candidates ({totalCandidates})
        </button>

        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.5rem 0.2rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                color: isSelected ? '#fff' : 'var(--text-main)',
                fontSize: '0.825rem',
              }}
            >
              <span
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                onClick={() => {
                  setSelectedFolderId(isSelected ? '' : folder.id);
                  setCurrentPage(1);
                }}
              >
                <Folder size={14} />
                {folder.name} ({folder.candidateCount})
              </span>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Edit folder"
                onClick={() => {
                  setFolderToEdit(folder);
                  setFolderNameInput(folder.name);
                  setFolderDescInput(folder.description || '');
                  setFolderActionError(null);
                  setIsEditFolderOpen(true);
                }}
              >
                <Edit2 size={12} />
              </button>

              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: isSelected ? '#fff' : 'var(--danger)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Delete folder"
                onClick={() => handleDeleteFolder(folder.id, folder.name)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {/* Keyword Search */}
          <div className="search-box-wrapper">
            <Search size={15} />
            <input
              type="text"
              className="input"
              placeholder="Search by name, email, code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Skills Filter */}
          <div className="search-box-wrapper">
            <Tag size={15} />
            <input
              type="text"
              className="input"
              placeholder="Skills (e.g. React, Python)..."
              value={skillsTerm}
              onChange={(e) => {
                setSkillsTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Application Stage Filter */}
          <div>
            <select
              className="input"
              value={selectedStage}
              onChange={(e) => {
                setSelectedStage(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '100%', height: '38px' }}
            >
              <option value="">All Application Stages</option>
              {Object.values(ApplicationStage).map((stage) => (
                <option key={stage} value={stage}>
                  Stage: {stage}
                </option>
              ))}
            </select>
          </div>

          {/* Location Filter */}
          <div className="search-box-wrapper">
            <MapPin size={15} />
            <input
              type="text"
              className="input"
              placeholder="City, State, Country..."
              value={locationTerm}
              onChange={(e) => {
                setLocationTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* Second Row: Sorting & Reset */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <Filter size={14} />
            <span>Sort by:</span>
            <select
              className="input-field"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.825rem' }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="createdAt">Date Created</option>
              <option value="name">Candidate Name</option>
              <option value="lastAppliedAt">Recent Application</option>
            </select>

            <select
              className="input-field"
              style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.825rem' }}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={loadCandidates}>
            Retry
          </button>
        </div>
      )}

      {/* Candidates List / Table */}
      {loading && candidates.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '60%' }}>
                <div className="skeleton" style={{ width: '40%', height: '18px' }} />
                <div className="skeleton" style={{ width: '70%', height: '14px' }} />
              </div>
              <div className="skeleton" style={{ width: '90px', height: '30px' }} />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <Users size={48} style={{ color: 'var(--text-dim)', margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Candidates Found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 500, margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {searchTerm || skillsTerm || selectedStage || selectedFolderId || locationTerm
              ? 'No candidates in the database matched your active search filters. Try clearing or relaxing filter criteria.'
              : 'There are no candidate records in your agency talent pool yet. Candidates are automatically added when applications are submitted through careers pages or received via email.'}
          </p>
          {(searchTerm || skillsTerm || selectedStage || selectedFolderId || locationTerm) && (
            <button className="btn btn-secondary" onClick={resetFilters}>
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="glass-card"
              style={{
                padding: '1.25rem',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '1.25rem',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Candidate Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary)',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    {candidate.candidateCode}
                  </span>

                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>{candidate.name}</h3>

                  {candidate.location && (
                    <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={13} /> {candidate.location}
                      {candidate.country ? `, ${candidate.country}` : ''}
                    </span>
                  )}
                </div>

                {/* Contact Row */}
                <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Mail size={14} style={{ color: 'var(--text-dim)' }} /> {candidate.email}
                  </span>
                  {candidate.phone && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Phone size={14} style={{ color: 'var(--text-dim)' }} /> {candidate.phone}
                    </span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={14} style={{ color: 'var(--text-dim)' }} /> Added {new Date(candidate.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Skills Row */}
                {candidate.skills && candidate.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.15rem' }}>
                    {candidate.skills.map((skill, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '4px',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Applications Summary */}
                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 500, marginRight: '0.5rem' }}>
                    Applications ({candidate.totalApplications}):
                  </span>
                  {candidate.applications.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No active applications</span>
                  ) : (
                    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {candidate.applications.map((app) => (
                        <span
                          key={app.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.55rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.775rem',
                          }}
                        >
                          <Briefcase size={12} style={{ color: 'var(--text-dim)' }} />
                          <strong>{app.jobCode}</strong> - {app.jobTitle} ({app.clientName})
                          <span
                            style={{
                              marginLeft: '0.25rem',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontSize: '0.7rem',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: 'var(--primary)',
                              fontWeight: 600,
                            }}
                          >
                            {app.stage}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Folders row */}
                {candidate.folders && candidate.folders.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Folders:</span>
                    {candidate.folders.map((f) => (
                      <span
                        key={f.id}
                        style={{
                          fontSize: '0.725rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.45rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#34d399',
                          borderRadius: 'var(--radius-full)',
                        }}
                      >
                        <Folder size={11} /> {f.name}
                        <button
                          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}
                          title="Remove from folder"
                          onClick={() => handleRemoveCandidateFromFolder(f.id, candidate.id)}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 140 }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.825rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                >
                  <ExternalLink size={14} /> View Profile
                </button>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '0.825rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  onClick={() => {
                    setCandidateForJob(candidate);
                    setTargetJobId('');
                    setAssignNotes('');
                    setAssignError(null);
                    setAssignSuccessMessage(null);
                  }}
                >
                  <Briefcase size={14} /> Assign to Job
                </button>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '0.825rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  onClick={() => {
                    setCandidateForFolder(candidate);
                    setTargetFolderId(folders[0]?.id || '');
                  }}
                >
                  <Plus size={14} /> Add to Folder
                </button>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Page {currentPage} of {totalPages} ({totalCandidates} candidates)
              </span>
              <button
                className="btn btn-secondary"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* Modals */}
      {/* ==================================================================== */}

      {/* Candidate Profile Modal */}
      {selectedCandidateId && (
        <CandidateProfileModal
          candidateId={selectedCandidateId}
          onClose={() => setSelectedCandidateId(null)}
          onApplicationUpdated={() => {
            loadCandidates();
          }}
        />
      )}

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingFolder && setIsCreateFolderOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-folder-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <div className="modal-header-icon">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 id="create-folder-title">Create Talent Folder</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Organize candidates into reusable talent pools
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateFolderOpen(false)}
                aria-label="Close dialog"
                disabled={isSubmittingFolder}
              >
                <X size={16} />
              </button>
            </div>

            {folderActionError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{folderActionError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFolder}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="create-folder-name">
                  Folder Name <span className="required-star">*</span>
                </label>
                <input
                  id="create-folder-name"
                  type="text"
                  required
                  autoFocus
                  className="modal-input"
                  placeholder="e.g. Senior Frontend, React Leads, Executive"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  disabled={isSubmittingFolder}
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="create-folder-desc">
                  Description <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="create-folder-desc"
                  className="modal-input"
                  rows={3}
                  placeholder="Describe the candidate category or purpose of this folder..."
                  value={folderDescInput}
                  onChange={(e) => setFolderDescInput(e.target.value)}
                  disabled={isSubmittingFolder}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsCreateFolderOpen(false)}
                  disabled={isSubmittingFolder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={!folderNameInput.trim() || isSubmittingFolder}
                >
                  {isSubmittingFolder ? 'Creating Folder...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {isEditFolderOpen && folderToEdit && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingFolder && setIsEditFolderOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-folder-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <div className="modal-header-icon">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 id="edit-folder-title">Edit Folder</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Update talent folder name and details
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsEditFolderOpen(false)}
                aria-label="Close dialog"
                disabled={isSubmittingFolder}
              >
                <X size={16} />
              </button>
            </div>

            {folderActionError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{folderActionError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateFolder}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="edit-folder-name">
                  Folder Name <span className="required-star">*</span>
                </label>
                <input
                  id="edit-folder-name"
                  type="text"
                  required
                  autoFocus
                  className="modal-input"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  disabled={isSubmittingFolder}
                />
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="edit-folder-desc">
                  Description <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="edit-folder-desc"
                  className="modal-input"
                  rows={3}
                  value={folderDescInput}
                  onChange={(e) => setFolderDescInput(e.target.value)}
                  disabled={isSubmittingFolder}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setIsEditFolderOpen(false)}
                  disabled={isSubmittingFolder}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={!folderNameInput.trim() || isSubmittingFolder}
                >
                  {isSubmittingFolder ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Candidate to Folder Modal */}
      {candidateForFolder && (
        <div
          className="modal-backdrop"
          onClick={() => setCandidateForFolder(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-candidate-folder-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <div className="modal-header-icon">
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 id="add-candidate-folder-title">Add to Folder</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Assign candidate to an agency talent folder
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCandidateForFolder(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Add <strong>{candidateForFolder.name}</strong> ({candidateForFolder.candidateCode}) to an agency folder:
            </p>

            {folders.length === 0 ? (
              <div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                  No folders created yet. Please create a folder first.
                </p>
                <div className="modal-footer">
                  <button type="button" className="button-secondary" onClick={() => setCandidateForFolder(null)}>
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddCandidateToFolder}>
                <div className="modal-form-group">
                  <label className="modal-label" htmlFor="select-target-folder">
                    Select Folder <span className="required-star">*</span>
                  </label>
                  <select
                    id="select-target-folder"
                    className="modal-input"
                    required
                    value={targetFolderId}
                    onChange={(e) => setTargetFolderId(e.target.value)}
                  >
                    <option value="">-- Choose a Folder --</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.candidateCount} candidates)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="modal-footer">
                  <button type="button" className="button-secondary" onClick={() => setCandidateForFolder(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="button-primary" disabled={!targetFolderId}>
                    Add to Folder
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Assign Candidate to Job Modal */}
      {candidateForJob && (
        <div
          className="modal-backdrop"
          onClick={() => !submittingAssign && setCandidateForJob(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-job-title"
        >
          <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-wrap">
                <div className="modal-header-icon">
                  <Briefcase size={20} />
                </div>
                <div>
                  <h3 id="assign-job-title">Assign to Open Job</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Deploy candidate to an active vacancy pipeline
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCandidateForJob(null)}
                aria-label="Close dialog"
                disabled={submittingAssign}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
              Create a new application for <strong>{candidateForJob.name}</strong> ({candidateForJob.candidateCode}) for a vacancy in your agency:
            </p>

            {assignSuccessMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                <span>{assignSuccessMessage}</span>
              </div>
            )}

            {assignError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', marginBottom: '14px', fontSize: '12px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignCandidateToJob}>
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="select-target-job">
                  Select Target Job <span className="required-star">*</span>
                </label>
                <select
                  id="select-target-job"
                  className="modal-input"
                  required
                  value={targetJobId}
                  onChange={(e) => setTargetJobId(e.target.value)}
                  disabled={submittingAssign}
                >
                  <option value="">-- Choose an active vacancy --</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      [{job.jobCode}] {job.title} - {job.client?.name || 'Client'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="assign-job-notes">
                  Internal Recruiter Notes <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  id="assign-job-notes"
                  className="modal-input"
                  rows={3}
                  placeholder="Add rationale, matching criteria or recruiter context..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  disabled={submittingAssign}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCandidateForJob(null)}
                  disabled={submittingAssign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button-primary"
                  disabled={!targetJobId || submittingAssign}
                >
                  {submittingAssign ? 'Assigning...' : 'Assign Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
