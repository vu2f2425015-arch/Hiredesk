import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Activity, BriefcaseBusiness, Keyboard, LogIn, Search, UserPlus } from 'lucide-react';
import { UserRole } from '@hiredesk/shared';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';
import { ThemeToggle } from './components/ThemeToggle';
import { BackToTop } from './components/BackToTop';
import { CookieBanner } from './components/CookieBanner';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { PageLoadingSkeleton } from './components/PageLoadingSkeleton';
import { AppShell as WorkspaceShell } from './components/shell/AppShell';
import { API_BASE } from './lib/config';

// Code-split page views remain unchanged by the dashboard redesign.
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
  if (loading) return <PageLoadingSkeleton />;
  if (!profile) return <Navigate to="/login" replace />;
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
          <AppFrame />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

function AppFrame() {
  const { profile } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isClient = profile?.role === UserRole.CLIENT;

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = !!target && (
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      );

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (!isTyping && (event.key === '?' || (event.shiftKey && event.key === '/'))) {
        event.preventDefault();
        setShortcutsOpen((open) => !open);
      } else if (event.key === 'Escape') {
        setPaletteOpen(false);
        setShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.success && json.data) setHealth(json.data as HealthResponse);
        else throw new Error('Malformed health response');
      })
      .catch((loadError: unknown) => {
        setHealthError(loadError instanceof Error ? loadError.message : 'Health check failed');
      })
      .finally(() => setHealthLoading(false));
  }, []);

  const healthStatus = healthLoading ? 'loading' : health?.status === 'ok' ? 'ok' : 'error';
  const routes = (
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
        <Route path="/system-status" element={<SystemStatusView health={health} loading={healthLoading} error={healthError} />} />
      </Routes>
    </Suspense>
  );

  return (
    <div className="app-container">
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <BackToTop />
      <CookieBanner />

      {profile ? (
        <WorkspaceShell
          profile={profile}
          healthStatus={healthStatus}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        >
          {routes}
        </WorkspaceShell>
      ) : (
        <>
          <a href="#main-content" className="skip-link">Skip to main content</a>
          <header className="public-navbar">
            <NavLink to="/" className="public-brand"><BriefcaseBusiness size={19} aria-hidden="true" /> HiredeskHR</NavLink>
            <nav className="public-nav-actions" aria-label="Main navigation">
              <NavLink to="/system-status" className="public-status-link"><Activity size={15} aria-hidden="true" /> System status</NavLink>
              <button
                type="button"
                className="topbar-icon-button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search or jump to (Control or Command K)"
                title="Search or jump to (⌘K / Ctrl+K)"
              >
                <Search size={16} aria-hidden="true" />
              </button>
              <ThemeToggle />
              <button type="button" className="topbar-icon-button public-keyboard-button" onClick={() => setShortcutsOpen(true)} aria-label="Keyboard shortcuts">
                <Keyboard size={16} aria-hidden="true" />
              </button>
              <NavLink to="/login" className="button-secondary"><LogIn size={15} aria-hidden="true" /> Sign in</NavLink>
              <NavLink to="/register" className="button-primary"><UserPlus size={15} aria-hidden="true" /> Register</NavLink>
            </nav>
          </header>
          <main id="main-content" className="public-main" tabIndex={-1}>{routes}</main>
          <footer className="public-footer">
            <div className="public-footer-top">
              <div className="public-footer-brand">
                <div className="public-footer-logo">
                  <BriefcaseBusiness size={18} aria-hidden="true" />
                  <strong>HiredeskHR</strong>
                </div>
                <p className="public-footer-desc">
                  High-performance applicant tracking system and candidate intelligence platform built for modern recruitment agencies.
                </p>
                <div className="public-footer-status">
                  <span className="status-live-dot" /> All Cloud Systems Operational
                </div>
              </div>
              <div className="public-footer-links">
                <div className="footer-links-col">
                  <strong>Workspace</strong>
                  <NavLink to="/register">Create Agency</NavLink>
                  <NavLink to="/login">Sign In</NavLink>
                  <NavLink to="/system-status">System Health</NavLink>
                </div>
                <div className="footer-links-col">
                  <strong>Security & Infrastructure</strong>
                  <span>Multi-Tenant RBAC</span>
                  <span>PostgreSQL Pooler</span>
                  <span>Autonomous IMAP</span>
                </div>
              </div>
            </div>
            <div className="public-footer-bottom">
              <span>© {new Date().getFullYear()} HiredeskHR. All rights reserved.</span>
              <span>Enterprise Agency Recruitment Architecture</span>
            </div>
          </footer>
        </>
      )}
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
    <div className="dashboard-panel system-status-panel">
      <div className="panel-heading">
        <div><h1>System status</h1><p>API process health and service details.</p></div>
      </div>
      {loading ? (
        <p className="status-message" role="status">Checking the API health endpoint…</p>
      ) : error ? (
        <div className="dashboard-error" role="alert">
          <div><h2>API health check failed</h2><p>{error}</p></div>
        </div>
      ) : health ? (
        <dl className="system-status-grid">
          <div><dt>Service</dt><dd>{health.service}</dd></div>
          <div><dt>Status</dt><dd><span className="system-status-dot system-status-ok" aria-hidden="true" />{health.status}</dd></div>
          <div><dt>Environment</dt><dd>{health.environment}</dd></div>
          <div><dt>Uptime</dt><dd>{health.uptimeSeconds.toLocaleString()} seconds</dd></div>
          <div><dt>Version</dt><dd>v{health.version}</dd></div>
          <div><dt>Last checked</dt><dd>{new Date(health.timestamp).toLocaleString()}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
