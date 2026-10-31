import { NavLink, useLocation } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

function getCrumbs(pathname: string): Crumb[] {
  if (pathname.startsWith('/jobs/') && pathname !== '/jobs') {
    return [{ label: 'Jobs', to: '/jobs' }, { label: 'Pipeline' }];
  }

  const routes: Record<string, string> = {
    '/': 'Dashboard',
    '/jobs': 'Jobs',
    '/talent-pool': 'Talent pool',
    '/interviews': 'Interviews',
    '/unmatched': 'Unmatched applications',
    '/reports': 'Reports',
    '/client-portal': 'Client portal',
    '/system-status': 'System status',
  };

  return [{ label: routes[pathname] || 'Workspace' }];
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = getCrumbs(pathname);

  return (
    <nav className="app-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span className="app-breadcrumb-item" key={`${crumb.label}-${index}`}>
          {index > 0 && <span className="app-breadcrumb-separator" aria-hidden="true">/</span>}
          {crumb.to ? (
            <NavLink to={crumb.to} className="app-breadcrumb-link">{crumb.label}</NavLink>
          ) : (
            <span className="app-breadcrumb-current" aria-current="page">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
