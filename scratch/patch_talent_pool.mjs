import fs from 'fs';

const filePath = 'c:/MY PROJECTS/Hiredesk/apps/web/src/pages/TalentPoolView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isSubmittingFolder state
const targetState = `  const [folderActionError, setFolderActionError] = useState<string | null>(null);`;
const replacementState = `  const [folderActionError, setFolderActionError] = useState<string | null>(null);
  const [isSubmittingFolder, setIsSubmittingFolder] = useState<boolean>(false);`;

content = content.replace(targetState, replacementState);

// 2. Add Escape key effect
const targetEffect = `  useEffect(() => {
    if (token && isAuthorized) {
      loadCandidates();
    }
  }, [token, isAuthorized, loadCandidates]);`;

const replacementEffect = `  useEffect(() => {
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
  }, [isCreateFolderOpen, isEditFolderOpen, candidateForFolder, candidateForJob]);`;

content = content.replace(targetEffect, replacementEffect);

// 3. Update handleCreateFolder & handleUpdateFolder
const oldHandlers = `  // Handlers for Folder operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !folderNameInput.trim()) return;
    setFolderActionError(null);
    try {
      await createTalentPoolFolder(token, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
      setFolderNameInput('');
      setFolderDescInput('');
      setIsCreateFolderOpen(false);
      loadMetadata();
    } catch (err: any) {
      setFolderActionError(err.message || 'Failed to create folder');
    }
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !folderToEdit || !folderNameInput.trim()) return;
    setFolderActionError(null);
    try {
      await updateTalentPoolFolder(token, folderToEdit.id, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
      setFolderToEdit(null);
      setIsEditFolderOpen(false);
      loadMetadata();
    } catch (err: any) {
      setFolderActionError(err.message || 'Failed to update folder');
    }
  };`;

const newHandlers = `  // Handlers for Folder operations
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !folderNameInput.trim() || isSubmittingFolder) return;
    setFolderActionError(null);
    setIsSubmittingFolder(true);
    try {
      await createTalentPoolFolder(token, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
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
      await updateTalentPoolFolder(token, folderToEdit.id, {
        name: folderNameInput.trim(),
        description: folderDescInput.trim() || undefined,
      });
      setFolderToEdit(null);
      setIsEditFolderOpen(false);
      await loadMetadata();
    } catch (err: any) {
      setFolderActionError(err.message || 'Failed to update folder');
    } finally {
      setIsSubmittingFolder(false);
    }
  };`;

content = content.replace(oldHandlers, newHandlers);

// 4. Update the modals
const modalStartIndex = content.indexOf('{/* Create Folder Modal */}');
if (modalStartIndex === -1) {
  console.error('Could not find modal start index');
  process.exit(1);
}

const newModals = `{/* Create Folder Modal */}
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
`;

content = content.substring(0, modalStartIndex) + newModals;
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched TalentPoolView.tsx');

