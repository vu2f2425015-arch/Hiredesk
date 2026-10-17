import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  Briefcase,
  Layers,
  Inbox,
  Activity,
  LogIn,
  LogOut,
  User as UserIcon,
  Calendar,
  Users,
  TrendingUp,
  Search,
  Menu,
  X,
  Keyboard,
} from 'lucide-react';
import { UserRole } from '@hiredesk/shared';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { NotificationBell } from './components/NotificationBell';
import { ThemeToggle } from './components/ThemeToggle';
import { BackToTop } from './components/BackToTop';
import { CookieBanner } from './components/CookieBanner';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PageLoadingSkeleton } from './components/PageLoadingSkeleton';
import { API_BASE } from './lib/config';

// Code Splitting & Lazy Loaded Routes
const DashboardView = lazy(() => import('./pages/DashboardView').then((m) => ({ default: m.DashboardView })));
const JobsView = lazy(() => import('./pages/JobsView').then((m) => ({ default: m.JobsView })));
const InterviewsView = lazy(() => import('./pages/InterviewsView').then((m) => ({ default: m.InterviewsView })));
const TalentPoolView = lazy(() => import('./pages/TalentPoolView').then((m) => ({ default: m.TalentPoolView })));
const ReportsView = lazy(() => import('./pages/ReportsView').then((m) => ({ default: m.ReportsView })));
const UnmatchedApplicationsView = lazy(() =>
  import('./pages/UnmatchedApplicationsView').then((m) => ({ default: m.UnmatchedApplicationsView }))
);
const ClientPortalView = lazy(() => import('./pages/ClientPortalView').then((m) => ({ default: m.ClientPortalView })));
const PublicCareerView = lazy(() => import('./pages/PublicCareerView').then((m) => ({ default: m.PublicCareerView })));
const AuthView = lazy(() => import('./pages/AuthView').then((m) => ({ default: m.AuthView })));

interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { profile, loading } = useAuth();
  if (loading) {
    return <PageLoadingSkeleton />;
  }
  if (!profile) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to={profile.role === UserRole.CLIENT ? '/client-portal' : '/'} replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

function AppShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { profile, signOut } = useAuth();
  const isClient = profile?.role === UserRole.CLIENT;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if active in an input/textarea
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      } else if (!isInput && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          setHealth(json.data);
        } else {
          throw new Error('Malformed health payload');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="app-container">
      {/* Skip to Content accessible link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Overlays & Dialogs */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <BackToTop />
      <CookieBanner />

      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Mobile hamburger menu trigger */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <div className="brand">
              <Briefcase style={{ color: 'var(--primary)', width: 22, height: 22 }} />
              <span>
                Hiredesk<span style={{ color: 'var(--primary)' }}>HR</span>
              </span>
              <span className="brand-badge">{isClient ? 'Client' : 'Agency'}</span>
            </div>
          </NavLink>

          <button
            className="nav-search-trigger"
            onClick={() => setPaletteOpen(true)}
            type="button"
            title="Search vacancies, navigation & actions (Ctrl+K)"
          >
            <Search size={14} />
            <span className="nav-search-trigger-text">Search vacancies...</span>
            <kbd className="kbd-pill">⌘K</kbd>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="nav-links" aria-label="Main Navigation">
          {!profile ? (
            <>
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <Layers size={15} /> Overview
              </NavLink>
              <NavLink to="/system-status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Activity size={15} /> System Health
              </NavLink>
            </>
          ) : isClient ? (
            <>
              <NavLink to="/client-portal" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Briefcase size={15} /> Client Portal
              </NavLink>
              <NavLink to="/system-status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Activity size={15} /> System Health
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                <Layers size={15} /> Dashboard
              </NavLink>
              <NavLink to="/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Briefcase size={15} /> Jobs
              </NavLink>
              <NavLink to="/interviews" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Calendar size={15} /> Interviews
              </NavLink>
              <NavLink to="/talent-pool" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Users size={15} /> Talent Pool
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <TrendingUp size={15} /> Reports
              </NavLink>
              <NavLink to="/unmatched" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <Inbox size={15} /> Unmatched
              </NavLink>
            </>
          )}
        </nav>

        {/* Right side controls: Health pill, Dark mode toggle, Shortcuts button, Notification, User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <NavLink
            to="/system-status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.5rem',
              background: health?.status === 'ok' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${health?.status === 'ok' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: health?.status === 'ok' ? 'var(--success)' : 'var(--danger)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
            title="System Diagnostics"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'currentColor',
                boxShadow: '0 0 6px currentColor',
                display: 'inline-block',
              }}
            />
            <span>{loading ? 'API...' : health?.status === 'ok' ? `API v${health.version}` : 'Offline'}</span>
          </NavLink>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Keyboard Shortcuts Trigger Button */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.55rem', borderRadius: '6px' }}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard size={14} />
          </button>

          {profile && !isClient && <NotificationBell />}

          {profile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.25rem 0.65rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <UserIcon size={13} color="var(--primary)" />
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{profile.firstName}</span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    color: isClient ? 'var(--accent-cyan)' : 'var(--primary)',
                    background: isClient ? 'rgba(6, 182, 212, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                    padding: '0.05rem 0.35rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {profile.role}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px' }}
                onClick={signOut}
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <NavLink to="/login" className="btn btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                <LogIn size={14} /> Sign In
              </NavLink>
              <NavLink to="/register" className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                Register
              </NavLink>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Navigation */}
      <div className={`mobile-menu-drawer ${mobileMenuOpen ? 'is-open' : ''}`} role="navigation" aria-label="Mobile Navigation">
        {!profile ? (
          <>
            <NavLink
              to="/"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              end
            >
              <Layers size={18} /> Overview
            </NavLink>
            <NavLink
              to="/system-status"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Activity size={18} /> System Health
            </NavLink>
            <NavLink
              to="/login"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <LogIn size={18} /> Sign In
            </NavLink>
            <NavLink
              to="/register"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Briefcase size={18} /> Register Agency
            </NavLink>
          </>
        ) : isClient ? (
          <>
            <NavLink
              to="/client-portal"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Briefcase size={18} /> Client Portal
            </NavLink>
            <NavLink
              to="/system-status"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Activity size={18} /> System Health
            </NavLink>
          </>
        ) : (
          <>
            <NavLink
              to="/"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              end
            >
              <Layers size={18} /> Dashboard
            </NavLink>
            <NavLink
              to="/jobs"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Briefcase size={18} /> Jobs & Vacancies
            </NavLink>
            <NavLink
              to="/interviews"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Calendar size={18} /> Interviews Calendar
            </NavLink>
            <NavLink
              to="/talent-pool"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Users size={18} /> Talent Pool
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <TrendingUp size={18} /> Reports & Analytics
            </NavLink>
            <NavLink
              to="/unmatched"
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Inbox size={18} /> Unmatched Applications
            </NavLink>
          </>
        )}
      </div>

      {/* Main Content Area with Suspense Code-Splitting */}
      <main id="main-content" className="main-content" tabIndex={-1}>
        <Suspense fallback={<PageLoadingSkeleton />}>
          <Routes>
            <Route path="/" element={isClient ? <ClientPortalView /> : <DashboardView />} />
            <Route
              path="/client-portal"
              element={
                <ProtectedRoute allowedRoles={[UserRole.CLIENT, UserRole.SUPER_ADMIN]}>
                  <ClientPortalView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login"
              element={profile ? <Navigate to={isClient ? '/client-portal' : '/'} replace /> : <AuthView initialMode="login" />}
            />
            <Route
              path="/register"
              element={profile ? <Navigate to={isClient ? '/client-portal' : '/'} replace /> : <AuthView initialMode="register" />}
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER]}>
                  <JobsView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews"
              element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER]}>
                  <InterviewsView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/talent-pool"
              element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER]}>
                  <TalentPoolView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER]}>
                  <ReportsView />
                </ProtectedRoute>
              }
            />
            <Route path="/career/:orgSlug" element={<PublicCareerView />} />
            <Route path="/career/:orgSlug/:jobCode" element={<PublicCareerView />} />
            <Route
              path="/unmatched"
              element={
                <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.MANAGER, UserRole.RECRUITER]}>
                  <UnmatchedApplicationsView />
                </ProtectedRoute>
              }
            />
            <Route path="/system-status" element={<SystemStatusView health={health} loading={loading} error={error} />} />
          </Routes>
        </Suspense>
      </main>

      <footer className="footer">
        <p>
          HiredeskHR &bull; Multi-Tenant Recruitment Architecture &bull; Supabase Auth & Multi-Tenant Security &bull; Press{' '}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
              font: 'inherit',
            }}
          >
            ? for shortcuts
          </button>
        </p>
      </footer>
    </div>
  );
}

function SystemStatusView({
  health,
  loading,
  error,
}: {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="glass-card">
      <h2 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Activity style={{ color: 'var(--primary)' }} /> Live Service Diagnostics
      </h2>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>
          Querying Express <code>/api/health</code> endpoint...
        </p>
      ) : error ? (
        <div style={{ color: 'var(--danger)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)' }}>
          Failed to connect to API gateway: {error}
        </div>
      ) : health ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Service</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{health.service}</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Status</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--success)' }}>{health.status.toUpperCase()}</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Environment</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{health.environment}</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Server Uptime</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{health.uptimeSeconds}s</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Version</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>v{health.version}</div>
          </div>
          <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Server Timestamp</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{new Date(health.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
