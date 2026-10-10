import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  Briefcase,
  Layers,
  Inbox,
  Activity,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Server,
  Database,
  Cpu,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthView } from './pages/AuthView';

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
            <Layers size={16} /> Overview
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
          <Route path="/" element={<OverviewView health={health} loading={loading} error={error} />} />
          <Route path="/login" element={<AuthView />} />
          <Route path="/jobs" element={<JobsPlaceholderView />} />
          <Route path="/unmatched" element={<UnmatchedPlaceholderView />} />
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

function OverviewView({
  health,
  loading,
  error,
}: {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
}) {
  const { profile } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Recruitment Agency ATS Foundation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '800px' }}>
          HiredeskHR enables recruitment agencies to manage multiple client pipelines, maintain strict tenant boundaries,
          and bridge job aggregator applications through concurrency-safe Job Codes.
        </p>
        {profile && (
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)' }}>
            <CheckCircle2 size={16} /> Authenticated as <strong>{profile.fullName || profile.email}</strong> ({profile.role.toUpperCase()}) &bull; Tenant: {profile.organizationName || 'Platform Super-Admin'}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Server style={{ color: 'var(--accent-cyan)' }} size={24} />
            <h3>Express Auth & RBAC Gateway</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Protected APIs verifying Supabase JWTs, attaching trusted <code>req.user</code> context, and strictly enforcing tenant and client boundaries.
          </p>
          <div style={{ fontSize: '0.85rem', color: health?.status === 'ok' ? 'var(--success)' : 'var(--text-dim)' }}>
            Status: {loading ? 'Querying...' : health?.status === 'ok' ? 'Connected & Healthy' : error || 'Offline'}
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Database style={{ color: 'var(--accent-violet)' }} size={24} />
            <h3>Multi-Tenant Data Isolation</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Hierarchical isolation enforcing Agency Organizations &rarr; Clients &rarr; Jobs &rarr; Candidates &rarr; Applications.
          </p>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Source: <code>packages/database/prisma/schema.prisma</code>
          </div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Cpu style={{ color: 'var(--primary)' }} size={24} />
            <h3>IMAP Ingestion Worker</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Dedicated Node daemon with <code>jobCodeExtractor</code> tested for dash variants, case insensitivity, and email body fallbacks.
          </p>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Extractor verified with 9 comprehensive unit tests.
          </div>
        </div>
      </div>

      <div className="glass-card">
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck style={{ color: 'var(--success)' }} size={20} /> Project Architectural Documentation
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.95rem' }}>
          All technical specifications, security models, and acceptance tests are verified in the local workspace:
        </p>
        <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/PRODUCT_SPEC.md</code> &bull; User roles & workflows
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/ARCHITECTURE.md</code> &bull; Component topologies
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/DATA_MODEL.md</code> &bull; Full ERD & sequence specs
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/SECURITY_MODEL.md</code> &bull; Multi-tenant RLS & RBAC
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/ACCEPTANCE_TESTS.md</code> &bull; Critical 11-step gate
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>
              <code>docs/DECISIONS.md</code> &bull; 7 Architectural Decision Records
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function JobsPlaceholderView() {
  const { profile } = useAuth();

  return (
    <div className="empty-state">
      <Briefcase className="empty-icon" size={48} />
      <h2 className="empty-title">Job Management Pipeline</h2>
      <p className="empty-desc">
        Vacancies, atomic global Job Codes (<code>JOB-1001</code>), and client associations will be unlocked in Phase 2.
        In compliance with our zero-fake-data policy, no mock jobs are simulated.
      </p>
      <div style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
        <span className="status-pill status-offline">Phase 2: Pending</span>
        {profile ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Authorized as: <strong>{profile.role.toUpperCase()}</strong> ({profile.organizationName || 'Platform'})
          </span>
        ) : (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Sign in to prepare your agency workspace</span>
        )}
      </div>
    </div>
  );
}

function UnmatchedPlaceholderView() {
  return (
    <div className="empty-state">
      <Inbox className="empty-icon" size={48} />
      <h2 className="empty-title">Unmatched Applications Queue</h2>
      <p className="empty-desc">
        Inbound application emails lacking valid Job Codes or requiring manual recruiter review will appear here in Phase 4.
      </p>
      <div style={{ display: 'inline-flex', gap: '0.75rem' }}>
        <span className="status-pill status-offline">Phase 4: Pending</span>
      </div>
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
