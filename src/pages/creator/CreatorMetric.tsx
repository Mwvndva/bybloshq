import type React from 'react';

export function Metric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
    </div>
  );
}
