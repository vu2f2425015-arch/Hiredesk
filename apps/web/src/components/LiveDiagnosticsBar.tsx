import { useState, useEffect } from 'react';
import { Database, Mail, Zap, RefreshCw, ShieldCheck } from 'lucide-react';
import { useToast } from './Toast';
import { API_BASE } from '../lib/config';

export function LiveDiagnosticsBar() {
  const [latency, setLatency] = useState<number | null>(null);
  const [pinging, setPinging] = useState(false);
  const [serviceInfo, setServiceInfo] = useState<{ uptime: number; version: string; env: string } | null>(null);
  const { success } = useToast();

  const pingApi = async (): Promise<boolean> => {
    setPinging(true);
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      const end = performance.now();
      const roundtrip = Math.round(end - start);
      if (res.ok) {
        setLatency(roundtrip);
        const json = await res.json();
        if (json.data) {
          setServiceInfo({
            uptime: json.data.uptimeSeconds,
            version: json.data.version,
            env: json.data.environment,
          });
        }
        return true;
      } else {
        setLatency(-1);
        return false;
      }
    } catch {
      setLatency(-1);
      return false;
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    pingApi();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        background: 'rgba(18, 24, 38, 0.4)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        {/* API Latency */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Zap size={14} color="var(--primary)" />
          <span style={{ color: 'var(--text-dim)' }}>API Gateway:</span>
          <span style={{ fontWeight: 600, color: latency !== null && latency >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {latency === null ? 'Pinging...' : latency >= 0 ? `${latency}ms` : 'Error'}
          </span>
        </div>

        {/* The public health endpoint does not currently probe the database. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Database size={14} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-dim)' }}>Database check:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            Not exposed
          </span>
        </div>

        {/* The API health endpoint cannot verify the separate IMAP worker or SMTP delivery. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Mail size={14} color="var(--accent-violet)" />
          <span style={{ color: 'var(--text-dim)' }}>Mail worker:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
            Status not exposed
          </span>
        </div>

        {/* Tenant Isolation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="var(--text-dim)" />
          <span style={{ color: 'var(--text-dim)' }}>Tenant access:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            Backend scoped
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {serviceInfo && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', padding: '0.2rem 0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}>
            v{serviceInfo.version} &bull; up {serviceInfo.uptime}s
          </span>
        )}
        <button
          className="btn btn-secondary"
          onClick={() => {
            void pingApi().then((reachable) => {
              if (reachable) success('API responded to the health check.');
            });
          }}
          disabled={pinging}
          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <RefreshCw size={12} className={pinging ? 'pulse-dot' : ''} />
          {pinging ? 'Testing...' : 'Ping Latency'}
        </button>
      </div>
    </div>
  );
}
