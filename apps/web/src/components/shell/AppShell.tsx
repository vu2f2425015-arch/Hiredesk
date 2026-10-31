import { ReactNode, useCallback, useState } from 'react';
import { TrustedUserProfile } from '../../context/AuthContext';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  profile: TrustedUserProfile;
  healthStatus: 'ok' | 'error' | 'loading';
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  children: ReactNode;
}

function getInitialCollapsedState(): boolean {
  try {
    const saved = localStorage.getItem('hiredesk-sidebar-collapsed');
    if (saved === 'true' || saved === 'false') return saved === 'true';
    return window.matchMedia('(min-width: 1024px) and (max-width: 1279px)').matches;
  } catch {
    return false;
  }
}

export function AppShell({
  profile,
  healthStatus,
  onOpenPalette,
  onOpenShortcuts,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        localStorage.setItem('hiredesk-sidebar-collapsed', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <div className={`app-shell${collapsed ? ' app-shell-collapsed' : ''}${mobileOpen ? ' app-shell-mobile-open' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Sidebar
        profile={profile}
        healthStatus={healthStatus}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={closeMobile}
        onOpenShortcuts={onOpenShortcuts}
      />
      <div className="app-shell-main-column">
        <TopBar
          profile={profile}
          onOpenPalette={onOpenPalette}
          onOpenShortcuts={onOpenShortcuts}
          onToggleSidebar={() => setMobileOpen((open) => !open)}
          mobileOpen={mobileOpen}
        />
        <main id="main-content" className="app-shell-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
