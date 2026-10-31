import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: number;
  description: string;
  to?: string;
}

export function StatCard({ label, value, description, to }: StatCardProps) {
  const content = (
    <>
      <span className="stat-card-label">{label}</span>
      <strong className="stat-card-value">{value.toLocaleString()}</strong>
      <span className="stat-card-description">{description}</span>
    </>
  );

  if (to) {
    return <Link className="stat-card stat-card-link" to={to}>{content}</Link>;
  }

  return <div className="stat-card">{content}</div>;
}
