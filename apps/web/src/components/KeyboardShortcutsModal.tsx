import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘K / Ctrl+K', description: 'Open Command Palette & Vacancy Search' },
    { key: '?', description: 'Toggle this Keyboard Shortcuts Help dialog' },
    { key: 'Esc', description: 'Close modals, drawers, or active menus' },
    { key: 'Alt + 1', description: 'Navigate to Dashboard' },
    { key: 'Alt + 2', description: 'Navigate to Jobs / Vacancies' },
    { key: 'Alt + 3', description: 'Navigate to Interviews Calendar' },
    { key: 'Alt + 4', description: 'Navigate to Talent Pool' },
    { key: 'Alt + 5', description: 'Navigate to Reports' },
    { key: 'Alt + 6', description: 'Navigate to Unmatched Applications' },
  ];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Keyboard size={22} style={{ color: 'var(--primary)' }} />
            <h2 id="shortcuts-title" style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.5rem', borderRadius: '6px' }}
            aria-label="Close shortcuts dialog"
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
          Accelerate your recruitment workflows with standard HiredeskHR keyboard shortcuts.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{s.description}</span>
              <kbd
                className="kbd-pill"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.55rem',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '4px',
                }}
              >
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button onClick={onClose} className="btn btn-primary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}>
            Close Help
          </button>
        </div>
      </div>
    </div>
  );
}
