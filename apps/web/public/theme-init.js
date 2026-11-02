(() => {
  try {
    const saved = localStorage.getItem('hiredesk-theme');
    const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const theme = saved || (systemDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', theme === 'light' ? '#f8fafc' : '#0a0d14');
    }
  } catch {
    // Theme preference storage is optional; the application can render with its default theme.
  }
})();
