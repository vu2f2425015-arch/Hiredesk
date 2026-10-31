import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: number | string;
  description: string;
  to?: string;
  icon?: ReactNode;
  tone?: 'primary' | 'violet' | 'emerald' | 'amber' | 'cyan';
  badge?: string;
  trend?: string;
}

export function StatCard({ label, value, description, to, icon, tone = 'primary', badge, trend }: StatCardProps) {
  const content = (
    <div className={`stat-card-inner tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className={`stat-card-icon-wrap tone-${tone}`}>{icon}</span>}
      </div>
      <div className="stat-card-value-wrap">
        <strong className="stat-card-value">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </strong>
        {badge && <span className={`stat-card-badge tone-${tone}`}>{badge}</span>}
        {trend && <span className="stat-card-trend">{trend}</span>}
      </div>
      <span className="stat-card-description">{description}</span>
    </div>
  );

  if (to) {
    return <Link className="stat-card stat-card-link" to={to}>{content}</Link>;
  }

  return <div className="stat-card">{content}</div>;
}
