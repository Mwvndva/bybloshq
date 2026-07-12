import type { ReactNode } from 'react';

export function DashboardStat({
  label,
  value,
  icon,
  tone = 'border-stone-200 bg-white',
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-3 flex items-center justify-between gap-3 text-stone-500">
        <span className="text-xs font-semibold">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

export { RequestCard } from './MzigoRequestCard';
