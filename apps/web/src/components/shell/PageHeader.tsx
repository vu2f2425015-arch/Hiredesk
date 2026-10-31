import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryActions?: ReactNode;
}

export function PageHeader({ title, description, action, secondaryActions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {(action || secondaryActions) && (
        <div className="page-header-actions">
          {secondaryActions}
          {action}
        </div>
      )}
    </header>
  );
}
