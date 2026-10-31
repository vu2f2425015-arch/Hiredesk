import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleUserRound,
  Command,
  LayoutDashboard,
  ListTodo,
  LogOut,
  UsersRound,
} from 'lucide-react';
import { UserRole } from '@hiredesk/shared';
import { TrustedUserProfile, useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ThemeToggle';

interface SidebarProps {
  profile: TrustedUserProfile;
  healthStatus: 'ok' | 'error' | 'loading';
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onOpenShortcuts: () => void;
}

const STAFF_ROLES = [UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER];

export function Sidebar({
  profile,
  healthStatus,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onOpenShortcuts,
}: SidebarProps) {
  const { signOut } = useAuth();
  const accountRef = useRef<HTMLDetailsElement>(null);
  const isStaff = profile.role !== UserRole.CLIENT;
  const items = [
    { label: 'Dashboard', to: '/', icon: LayoutDashboard, roles: STAFF_ROLES },
    { label: 'Jobs', to: '/jobs', icon: BriefcaseBusiness, roles: STAFF_ROLES },
    { label: 'Talent pool', to: '/talent-pool', icon: UsersRound, roles: STAFF_ROLES },
    { label: 'Interviews', to: '/interviews', icon: CalendarDays, roles: STAFF_ROLES },
    { label: 'Unmatched', to: '/unmatched', icon: ListTodo, roles: STAFF_ROLES },
    { label: 'Reports', to: '/reports', icon: Activity, roles: STAFF_ROLES },
    { label: 'Client portal', to: '/client-portal', icon: BriefcaseBusiness, roles: [UserRole.CLIENT, UserRole.SUPER_ADMIN] },
  ].filter((item) => item.roles.includes(profile.role));

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <button className="app-sidebar-scrim" type="button" aria-label="Close navigation" onClick={onCloseMobile} />
      )}
      <aside
        id="app-sidebar"
        className={`app-sidebar${collapsed ? ' app-sidebar-collapsed' : ''}${mobileOpen ? ' app-sidebar-mobile-open' : ''}`}
        aria-label="Primary navigation"
      >
        <NavLink to="/" className="app-brand" onClick={onCloseMobile} aria-label="HiredeskHR home">
          <span className="app-brand-mark" aria-hidden="true"><BriefcaseBusiness size={19} /></span>
          <span className="app-brand-name">HiredeskHR</span>
        </NavLink>

        <div className="app-sidebar-organization" title={profile.organizationName || 'HiredeskHR'}>
          <span className="organization-mark" aria-hidden="true">{(profile.organizationName || 'H')[0].toUpperCase()}</span>
          <span className="organization-name">{profile.organizationName || 'Platform workspace'}</span>
        </div>

        <nav className="app-sidebar-nav" aria-label="Workspace">
          <span className="sidebar-section-label">Workspace</span>
          {items.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              onClick={onCloseMobile}
              className={({ isActive }) => `sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="sidebar-link-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <NavLink to="/system-status" className="system-status-link" onClick={onCloseMobile}>
            <span className={`system-status-dot system-status-${healthStatus}`} aria-hidden="true" />
            <span className="sidebar-link-label">System status</span>
          </NavLink>

          {isStaff && (
            <button
              type="button"
              className="sidebar-collapse-button"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              <span className="sidebar-link-label">{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
            </button>
          )}

          <details className="sidebar-account" ref={accountRef}>
            <summary className="sidebar-account-trigger" title={collapsed ? profile.fullName || profile.email : undefined}>
              <CircleUserRound size={19} aria-hidden="true" />
              <span className="sidebar-account-summary">
                <span className="sidebar-account-name">{profile.fullName || profile.firstName || profile.email}</span>
                <span className="sidebar-role-badge">{profile.role.replace('_', ' ')}</span>
              </span>
              <ChevronDown className="sidebar-account-chevron" size={14} aria-hidden="true" />
            </summary>
            <div className="sidebar-account-popover">
              <div className="sidebar-account-popover-heading">
                <span className="sidebar-account-name">{profile.fullName || profile.email}</span>
                <span className="sidebar-role-badge">{profile.role.replace('_', ' ')}</span>
              </div>
              <ThemeToggle variant="menu-item" />
              <button type="button" className="sidebar-popover-button" onClick={onOpenShortcuts}>
                <Command size={16} aria-hidden="true" /> Keyboard shortcuts
              </button>
              <button type="button" className="sidebar-popover-button" onClick={() => void signOut()}>
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
              <span className="visually-hidden">{profile.email}</span>
            </div>
          </details>
        </div>
      </aside>
    </>
  );
}
