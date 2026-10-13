import { useState, useEffect } from 'react';
import { ShieldCheck, Check } from 'lucide-react';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const acknowledged = localStorage.getItem('hiredesk-storage-ack');
      if (!acknowledged) {
        setVisible(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem('hiredesk-storage-ack', 'true');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="essential-storage-banner" role="region" aria-label="Storage and privacy disclosure">
      <div className="storage-banner-header">
        <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
        <span>Privacy & Essential Storage</span>
      </div>
      <div className="storage-banner-body">
        HiredeskHR uses strictly essential browser storage (Supabase authentication tokens and theme preferences). We do not use third-party tracking, advertising, or profiling cookies.
      </div>
      <div className="storage-banner-actions">
        <button
          type="button"
          onClick={handleDismiss}
          className="btn btn-primary"
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
        >
          <Check size={14} /> Got it
        </button>
      </div>
    </aside>
  );
}
