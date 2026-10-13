import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  Calendar,
  Users,
  TrendingUp,
  Inbox,
  Activity,
  Layers,
  ArrowRight,
  Sparkles,
  X,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from './Toast';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Live Jobs';
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
}

export function CommandPalette({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveJobs, setLiveJobs] = useState<Array<{ id: string; jobCode: string; title: string; clientName?: string }>>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { success } = useToast();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Fetch live jobs for quick jumping
      fetch('/api/jobs?limit=10')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.success && json?.data?.jobs) {
            setLiveJobs(json.data.jobs);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Base navigation commands
  const defaultCommands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Dashboard Overview',
      subtitle: 'View pipeline metrics, funnel analytics & recent applications',
      category: 'Navigation',
      icon: <Layers size={16} color="var(--primary)" />,
      action: () => {
        navigate('/');
        onClose();
      },
    },
    {
      id: 'nav-jobs',
      title: 'Vacancies & Jobs',
      subtitle: 'Manage agency jobs, atomic job codes & pipelines',
      category: 'Navigation',
      icon: <Briefcase size={16} color="var(--primary)" />,
      badge: 'Vacancies',
      action: () => {
        navigate('/jobs');
        onClose();
      },
    },
    {
      id: 'nav-interviews',
      title: 'Interviews & Schedules',
      subtitle: 'Calendar events, RFC 5545 .ics generator & conflict detection',
      category: 'Navigation',
      icon: <Calendar size={16} color="var(--accent-violet)" />,
      badge: 'Calendar',
      action: () => {
        navigate('/interviews');
        onClose();
      },
    },
    {
      id: 'nav-talent-pool',
      title: 'Talent Pool Folders',
      subtitle: 'Reusable candidate repository across all organization vacancies',
      category: 'Navigation',
      icon: <Users size={16} color="var(--accent-cyan)" />,
      action: () => {
        navigate('/talent-pool');
        onClose();
      },
    },
    {
      id: 'nav-reports',
      title: 'Analytics & Attribution',
      subtitle: 'Conversion funnel & candidate source distribution',
      category: 'Navigation',
      icon: <TrendingUp size={16} color="var(--success)" />,
      action: () => {
        navigate('/reports');
        onClose();
      },
    },
    {
      id: 'nav-unmatched',
      title: 'Unmatched Application Queue',
      subtitle: 'Triage parsed incoming emails missing valid job codes',
      category: 'Navigation',
      icon: <Inbox size={16} color="var(--warning)" />,
      badge: 'Inbound',
      action: () => {
        navigate('/unmatched');
        onClose();
      },
    },
    {
      id: 'nav-system-status',
      title: 'System Diagnostics & Health',
      subtitle: 'Real-time database, worker & API status latency ping',
      category: 'Navigation',
      icon: <Activity size={16} color="var(--success)" />,
      action: () => {
        navigate('/system-status');
        onClose();
      },
    },
    {
      id: 'nav-client-portal',
      title: 'Client Review Portal',
      subtitle: 'Isolated client interface with redacted internal recruiter notes',
      category: 'Navigation',
      icon: <ShieldCheck size={16} color="var(--accent-cyan)" />,
      badge: 'Client',
      action: () => {
        navigate('/client-portal');
        onClose();
      },
    },
    {
      id: 'action-new-job',
      title: 'Create New Vacancy',
      subtitle: 'Allocate next atomic Job Code (JOB-XXXX)',
      category: 'Actions',
      icon: <PlusCircle size={16} color="var(--primary)" />,
      action: () => {
        navigate('/jobs');
        onClose();
      },
    },
    {
      id: 'action-copy-api',
      title: 'Copy Health Endpoint URL',
      subtitle: 'Copies http://localhost:4000/health to clipboard',
      category: 'Actions',
      icon: <Sparkles size={16} color="var(--warning)" />,
      action: () => {
        navigator.clipboard.writeText('http://localhost:4000/health');
        success('Copied API health URL to clipboard!');
        onClose();
      },
    },
  ];

  // Convert live jobs to command items
  const jobCommands: CommandItem[] = liveJobs.map((j) => ({
    id: `job-${j.id}`,
    title: `${j.jobCode}: ${j.title}`,
    subtitle: j.clientName ? `Client: ${j.clientName}` : 'Agency Vacancy',
    category: 'Live Jobs',
    icon: <Briefcase size={16} color="var(--primary)" />,
    badge: j.jobCode,
    action: () => {
      navigate('/jobs');
      onClose();
    },
  }));

  const allItems = [...defaultCommands, ...jobCommands];

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const lower = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(lower) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(lower)) ||
      item.category.toLowerCase().includes(lower)
    );
  });

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command search">
      <div className="palette-card" onClick={(e) => e.stopPropagation()}>
        <div className="palette-header">
          <Search size={18} color="var(--text-dim)" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command, job code, or page name (e.g. 'JOB-1001', 'interviews', 'reports')..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          {query && (
            <button className="palette-clear" onClick={() => setQuery('')} aria-label="Clear query">
              <X size={14} />
            </button>
          )}
          <span className="kbd-shortcut">ESC</span>
        </div>

        <div className="palette-results">
          {filteredItems.length === 0 ? (
            <div className="palette-empty">
              <Search size={28} color="var(--text-dim)" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>No matching commands or jobs found for "{query}"</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="palette-item-icon">{item.icon}</div>
                <div className="palette-item-details">
                  <div className="palette-item-title">{item.title}</div>
                  {item.subtitle && <div className="palette-item-subtitle">{item.subtitle}</div>}
                </div>
                {item.badge && <span className="palette-item-badge">{item.badge}</span>}
                <ArrowRight size={14} className="palette-item-arrow" />
              </div>
            ))
          )}
        </div>

        <div className="palette-footer">
          <div className="palette-footer-hint">
            <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
          <div className="palette-footer-meta">
            HiredeskHR Interactive Command Center
          </div>
        </div>
      </div>
    </div>
  );
}
