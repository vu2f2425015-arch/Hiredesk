import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Briefcase,
  Layers,
  Inbox,
  Activity,
  AlertCircle,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './pages/AuthView';
import { JobsView } from './pages/JobsView';
import { DashboardView } from './pages/DashboardView';
import { PublicCareerView } from './pages/PublicCareerView';
import { UnmatchedApplicationsView } from './pages/UnmatchedApplicationsView';

interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

function AppShell() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { profile, signOut } = useAuth();

  useEffect(() => {
    fetch('/api/health')
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
      <header className="navbar">
        <div className="brand">
          <Briefcase style={{ color: 'var(--primary)', width: 24, height: 24 }} />
          <span>
            Hiredesk<span style={{ color: 'var(--primary)' }}>HR</span>
          </span>
          <span className="brand-badge">Agency ATS</span>
        </div>

        <nav className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <Layers size={16} /> Dashboard
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Briefcase size={16} /> Jobs
          </NavLink>
          <NavLink to="/unmatched" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Inbox size={16} /> Unmatched
          </NavLink>
          <NavLink to="/system-status" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Activity size={16} /> System Health
          </NavLink>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            {loading ? (
              <span className="status-pill status-offline">Checking API...</span>
            ) : health?.status === 'ok' ? (
              <span className="status-pill status-online">
                <span className="pulse-dot"></span> API Online (v{health.version})
              </span>
            ) : (
              <span className="status-pill status-offline">
                <AlertCircle size={14} /> API Disconnected
              </span>
            )}
          </div>

          {profile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <UserIcon size={14} color="var(--primary)" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{profile.firstName}</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(6, 182, 212, 0.1)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  {profile.role}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={signOut}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <NavLink to="/login" className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              <LogIn size={14} /> Sign In
            </NavLink>
          )}
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/login" element={<AuthView />} />
          <Route path="/jobs" element={<JobsView />} />
          <Route path="/career/:orgSlug" element={<PublicCareerView />} />
          <Route path="/career/:orgSlug/:jobCode" element={<PublicCareerView />} />
          <Route path="/unmatched" element={<UnmatchedApplicationsView />} />
          <Route path="/system-status" element={<SystemStatusView health={health} loading={loading} error={error} />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>
          HiredeskHR &bull; Multi-Tenant Recruitment Architecture &bull; Supabase Auth & Multi-Tenant Security &bull; Zero Mock Data Guarantee
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
