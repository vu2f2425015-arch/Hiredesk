import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'menu-item';
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('hiredesk-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('hiredesk-theme', theme);
      const meta = document.getElementById('theme-color-meta');
      if (meta) {
        meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#0a0d14');
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="sidebar-popover-button"
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <>
            <Sun size={16} aria-hidden="true" style={{ color: 'var(--warning)' }} />
            <span>Light mode</span>
          </>
        ) : (
          <>
            <Moon size={16} aria-hidden="true" style={{ color: 'var(--accent-text)' }} />
            <span>Dark mode</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="topbar-icon-button"
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={16} aria-hidden="true" style={{ color: 'var(--warning)' }} />
      ) : (
        <Moon size={16} aria-hidden="true" style={{ color: 'var(--accent-text)' }} />
      )}
    </button>
  );
}
