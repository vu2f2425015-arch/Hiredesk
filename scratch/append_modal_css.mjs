import fs from 'fs';

const cssPath = 'c:/MY PROJECTS/Hiredesk/apps/web/src/index.css';
let css = fs.readFileSync(cssPath, 'utf8');

const modalStyles = `
/* ==========================================================================
   Universal Modal System (Popups, Dialogs, Talent Folders)
   ========================================================================== */
.modal-backdrop {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 16px !important;
  background: rgba(4, 9, 20, 0.72) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  animation: modalBackdropFadeIn 180ms ease forwards;
  overflow-y: auto;
}

.modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  max-height: min(90vh, 720px);
  margin: auto;
  overflow-y: auto;
  padding: 24px 26px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl, 16px);
  background: var(--bg-surface);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);
  animation: modalContentPopIn 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes modalBackdropFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalContentPopIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.modal-header-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 11px;
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  border: 1px solid rgba(99, 102, 241, 0.22);
}

.modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 750;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.modal-close-btn,
.btn-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-raised);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 120ms ease;
}

.modal-close-btn:hover,
.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.modal-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.modal-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--text-secondary);
}

.modal-label .required-star {
  color: var(--danger, #ef4444);
  margin-left: 2px;
}

.modal-input {
  width: 100%;
  min-height: 42px;
  padding: 10px 14px;
  font-size: 13px;
  font-family: inherit;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: var(--bg-canvas);
  color: var(--text-primary);
  transition: border-color 140ms ease, box-shadow 140ms ease;
  box-sizing: border-box;
}

.modal-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}

textarea.modal-input {
  min-height: 84px;
  resize: vertical;
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

/* Dark theme overrides for modals */
[data-theme="dark"] .modal-content {
  background: #111a2b;
  border-color: #2a3d5e;
  box-shadow: 0 24px 50px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .modal-input {
  background: #0d1525;
  border-color: #273954;
  color: #f8fafc;
}

[data-theme="dark"] .modal-input:focus {
  border-color: #756ffc;
  box-shadow: 0 0 0 3px rgba(117, 111, 252, 0.25);
}

[data-theme="dark"] .modal-close-btn,
[data-theme="dark"] .btn-icon {
  background: #172338;
  border-color: #2b3d5c;
  color: #cbd5e1;
}

[data-theme="dark"] .modal-close-btn:hover,
[data-theme="dark"] .btn-icon:hover {
  background: #20304c;
  color: #fff;
  border-color: #4a638c;
}
`;

css += '\n' + modalStyles;
fs.writeFileSync(cssPath, css, 'utf8');
console.log('Successfully appended modal styles to index.css');

