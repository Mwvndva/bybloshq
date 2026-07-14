import type { ReactNode } from 'react';

export function DashboardStat({
  label,
  value,
  icon,
  tone = 'border-white/10 bg-white/[0.03]',
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/50">{label}</span>
        <span className="text-yellow-400">{icon}</span>
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export { RequestCard } from './MzigoRequestCard';
