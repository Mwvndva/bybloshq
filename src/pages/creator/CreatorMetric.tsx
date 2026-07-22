import type React from 'react';

export function Metric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0a0a0a] p-4 text-slate-950 dark:text-white shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-500 dark:text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}
