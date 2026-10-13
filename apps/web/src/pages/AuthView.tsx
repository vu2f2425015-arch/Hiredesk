import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Lock,
  Mail,
  AlertTriangle,
  ShieldCheck,
  LogIn,
  UserPlus,
  Building,
  User,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

interface AuthViewProps {
  initialMode?: 'login' | 'register';
}

export function AuthView({ initialMode = 'login' }: AuthViewProps) {
  const { user, profile, profileError, isConfigured, signIn, signUp, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Mode: 'login' | 'register' | 'forgot-password'
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>(() => {
    if (location.pathname === '/register') return 'register';
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'register') return 'register';
    return initialMode;
  });

  // Common fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration specific fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Feedback states
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemoLogins, setShowDemoLogins] = useState(false);

  // Sync mode with route if user navigates
  useEffect(() => {
    if (location.pathname === '/register') {
      setMode('register');
    } else if (location.pathname === '/login') {
      const params = new URLSearchParams(location.search);
      if (params.get('mode') === 'register') {
        setMode('register');
      }
    }
  }, [location.pathname, location.search]);

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!email || !password) {
      setSubmitError('Email and password are required');
      return;
    }

    setSubmitting(true);
    const res = await signIn(email.trim(), password);
    setSubmitting(false);

    if (!res.success && res.error) {
      setSubmitError(res.error);
    } else {
      navigate('/');
    }
  };

  // Handle Registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError('First and last name are required');
      return;
    }
    if (!email.trim()) {
      setSubmitError('Email address is required');
      return;
    }
    if (!organizationName.trim()) {
      setSubmitError('Agency or Organization name is required');
      return;
    }
    if (password.length < 8) {
      setSubmitError('Password must be at least 8 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    const res = await signUp({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      organizationName: organizationName.trim(),
      password,
    });
    setSubmitting(false);

    if (!res.success && res.error) {
      setSubmitError(res.error);
    } else {
      navigate('/');
    }
  };

  // Handle Password Reset submission
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setForgotMessage(null);

    if (!forgotEmail.trim()) {
      setSubmitError('Please enter your email address to receive reset instructions');
      return;
    }

    setSubmitting(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) {
          setSubmitError(error.message);
        } else {
          setForgotSent(true);
          setForgotMessage('If an account exists for this email address, a password recovery link has been dispatched.');
        }
      } else {
        setForgotSent(true);
        setForgotMessage('Reset link dispatched to your email address.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to dispatch password recovery email');
    } finally {
      setSubmitting(false);
    }
  };

  // When already authenticated
  if (user && profile) {
    return (
      <div className="glass-card" style={{ maxWidth: '560px', margin: '2rem auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <ShieldCheck style={{ color: 'var(--success)' }} size={28} />
          <div>
            <h2 style={{ fontSize: '1.25rem' }}>Active Authenticated Session</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Multi-tenant identity verified via Supabase Auth & PostgreSQL
            </p>
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
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Assigned Role</span>
              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{profile.role.toUpperCase()}</div>
            </div>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Agency / Organization</span>
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

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/')}>
            Go to Workspace Dashboard <ArrowRight size={16} />
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ maxWidth: '520px', margin: '2rem auto', position: 'relative' }}>
      {/* Brand Icon Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.75rem',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          {mode === 'register' ? (
            <UserPlus style={{ color: 'var(--primary)' }} size={24} />
          ) : mode === 'forgot-password' ? (
            <KeyRound style={{ color: 'var(--primary)' }} size={24} />
          ) : (
            <Lock style={{ color: 'var(--primary)' }} size={24} />
          )}
        </div>

        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.35rem', fontWeight: 700 }}>
          {mode === 'register'
            ? 'Create Agency Account'
            : mode === 'forgot-password'
            ? 'Reset Account Password'
            : 'Sign In to HiredeskHR'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
          {mode === 'register'
            ? 'Set up an isolated agency workspace with zero mock data and dedicated client portals'
            : mode === 'forgot-password'
            ? 'Enter your registered email to receive secure recovery instructions'
            : 'Access your recruitment agency workspace or client review portal'}
        </p>
      </div>

      {/* Mode Switcher Tabs (Only if not in forgot-password) */}
      {mode !== 'forgot-password' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setSubmitError(null);
            }}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'login' ? 'var(--primary)' : 'transparent',
              color: mode === 'login' ? '#ffffff' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
            }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setSubmitError(null);
            }}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'register' ? 'var(--primary)' : 'transparent',
              color: mode === 'register' ? '#ffffff' : 'var(--text-dim)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease',
            }}
          >
            <UserPlus size={15} /> Register Agency
          </button>
        </div>
      )}

      {/* Supabase unconfigured warning */}
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
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your environment file to enable live authentication.
            </p>
          </div>
        </div>
      )}

      {/* Errors or Notices */}
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
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{submitError || profileError}</span>
        </div>
      )}

      {forgotMessage && (
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            color: 'var(--success)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{forgotMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. SIGN IN FORM */}
      {/* ==================================================================== */}
      {mode === 'login' && (
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Password</label>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot-password');
                  setSubmitError(null);
                  setForgotMessage(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <Lock
                size={18}
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 2.75rem 0.75rem 2.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.95rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
            disabled={submitting || loading || !isConfigured}
          >
            {submitting || loading ? (
              'Authenticating...'
            ) : (
              <>
                Sign In to Workspace <LogIn size={16} />
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Need an agency account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setSubmitError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Register here
            </button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* 2. REGISTER AGENCY FORM */}
      {/* ==================================================================== */}
      {mode === 'register' && (
        <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* First & Last Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                First Name *
              </label>
              <div style={{ position: 'relative' }}>
                <User
                  size={16}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Sarah"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Jenkins"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Agency / Organization Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Agency / Organization Name *
            </label>
            <div style={{ position: 'relative' }}>
              <Building
                size={16}
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder="e.g. Apex Talent Solutions"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', display: 'block' }}>
              A dedicated, isolated multi-tenant organization will be provisioned for your team.
            </span>
          </div>

          {/* Work Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Work Email Address *
            </label>
            <div style={{ position: 'relative' }}>
              <Mail
                size={16}
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@apextalent.com"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Password & Confirm Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Password * (min 8)
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Confirm Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '0.65rem 0.75rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            <span>Security: 8+ chars required</span>
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
            >
              {showPassword ? 'Hide passwords' : 'Show passwords'}
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
            disabled={submitting || loading || !isConfigured}
          >
            {submitting || loading ? (
              'Creating Agency Workspace...'
            ) : (
              <>
                Create Workspace & Register <ArrowRight size={16} />
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setSubmitError(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Sign In
            </button>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* 3. FORGOT PASSWORD FORM */}
      {/* ==================================================================== */}
      {mode === 'forgot-password' && (
        forgotSent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Check your inbox for a password reset email. Follow the enclosed link to choose a new password.
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setMode('login');
                setForgotSent(false);
                setSubmitError(null);
                setForgotMessage(null);
              }}
            >
              Return to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Your Account Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={18}
                  style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}
                />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
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

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
              disabled={submitting || !isConfigured}
            >
              {submitting ? 'Dispatching Reset Link...' : 'Send Password Reset Link'}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => {
                setMode('login');
                setSubmitError(null);
                setForgotMessage(null);
              }}
            >
              Back to Sign In
            </button>
          </form>
        )
      )}

      {/* ==================================================================== */}
      {/* Fast Test / Demo Accounts (Collapsible for developer convenience) */}
      {/* ==================================================================== */}
      {isConfigured && (
        <div
          style={{
            marginTop: '1.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={13} color="var(--primary)" /> Pre-configured Testing Accounts
            </span>
            <button
              type="button"
              onClick={() => setShowDemoLogins((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-dim)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {showDemoLogins ? 'Hide' : 'Show quick fill'}
            </button>
          </div>

          {showDemoLogins && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                onClick={() => {
                  setMode('login');
                  setEmail('admin@hiredesk.io');
                  setPassword('AdminPassword123!');
                }}
              >
                Platform Admin (admin@hiredesk.io)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tenant Security Notice */}
      <div
        style={{
          marginTop: '1.25rem',
          fontSize: '0.75rem',
          color: 'var(--text-dim)',
          lineHeight: 1.5,
          textAlign: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <ShieldCheck size={13} color="var(--success)" /> Strict Multi-Tenant Isolation
        </span>
        &bull; Agency data, candidate notes, and client portals are cryptographically partitioned.
      </div>
    </div>
  );
}
