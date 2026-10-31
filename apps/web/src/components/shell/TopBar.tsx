import { Menu, Search, CircleHelp } from 'lucide-react';
import { TrustedUserProfile } from '../../context/AuthContext';
import { UserRole } from '@hiredesk/shared';
import { NotificationBell } from '../NotificationBell';
import { ThemeToggle } from '../ThemeToggle';
import { Breadcrumbs } from './Breadcrumbs';

interface TopBarProps {
  profile: TrustedUserProfile;
  onOpenPalette: () => void;
  onOpenShortcuts: () => void;
  onToggleSidebar: () => void;
  mobileOpen: boolean;
}

export function TopBar({ profile, onOpenPalette, onOpenShortcuts, onToggleSidebar, mobileOpen }: TopBarProps) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-left">
        <button
          type="button"
          className="topbar-menu-button"
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-controls="app-sidebar"
          aria-expanded={mobileOpen}
          onClick={onToggleSidebar}
        >
          <Menu size={19} aria-hidden="true" />
        </button>
        <Breadcrumbs />
      </div>

      <div className="app-topbar-actions">
        <button type="button" className="topbar-search-button" onClick={onOpenPalette}>
          <Search size={16} aria-hidden="true" />
          <span className="topbar-search-label">Search or jump to…</span>
          <kbd className="topbar-search-shortcut">⌘K</kbd>
        </button>
        <ThemeToggle />
        {profile.role !== UserRole.CLIENT && <NotificationBell />}
        <button
          type="button"
          className="topbar-icon-button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <CircleHelp size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
