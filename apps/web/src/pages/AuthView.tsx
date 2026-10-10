import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertTriangle, ShieldCheck, LogIn } from 'lucide-react';

export function AuthView() {
  const { user, profile, profileError, isConfigured, signIn, signOut, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!email || !password) {
      setSubmitError('Email and password are required');
      return;
    }

    setSubmitting(true);
    const res = await signIn(email, password);
    setSubmitting(false);

    if (!res.success && res.error) {
      setSubmitError(res.error);
    }
  };

  if (user && profile) {
    return (
      <div className="glass-card" style={{ maxWidth: '540px', margin: '2rem auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <ShieldCheck style={{ color: 'var(--success)' }} size={28} />
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Authenticated Session</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Verified via Supabase Auth and Express /api/me</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Full Name</span>
            <div style={{ fontWeight: 600 }}>{profile.fullName || `${profile.firstName} ${profile.lastName}`}</div>
          </div>
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Email</span>
            <div style={{ fontWeight: 600 }}>{profile.email}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Role</span>
              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{profile.role.toUpperCase()}</div>
            </div>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Organization</span>
              <div style={{ fontWeight: 600 }}>{profile.organizationName || 'Platform Level'}</div>
            </div>
          </div>
          {profile.clientName && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Assigned Client</span>
              <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{profile.clientName}</div>
            </div>
          )}
        </div>

        <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={signOut}>
          Sign Out of HiredeskHR
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ maxWidth: '480px', margin: '2rem auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}
        >
          <Lock style={{ color: 'var(--primary)' }} size={24} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Sign In to HiredeskHR</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Access your recruitment agency pipeline or client portal
        </p>
      </div>

      {!isConfigured && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--warning)',
            display: 'flex',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <div>
            <strong>Supabase Setup Required:</strong>
            <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file to enable live authentication.
            </p>
          </div>
        </div>
      )}

      {(submitError || profileError) && (
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--danger)',
          }}
        >
          {submitError || profileError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Email Address
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={18}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recruiter@agency.com"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={18}
              style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.75rem',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-main)',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          disabled={submitting || loading || !isConfigured}
        >
          {submitting || loading ? (
            'Verifying...'
          ) : (
            <>
              Sign In <LogIn size={16} />
            </>
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: '1.75rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8rem',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
        }}
      >
        <strong>Administrative Security Policy:</strong>
        <p style={{ marginTop: '0.25rem' }}>
          HiredeskHR enforces strict tenant boundaries. New accounts must be invited by an agency administrator or client manager.
          Initial platform super-admin access is granted exclusively through the documented server-side bootstrap procedure.
        </p>
      </div>
    </div>
  );
}
