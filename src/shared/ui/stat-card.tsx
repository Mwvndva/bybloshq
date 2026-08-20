import * as React from "react";
import { cn } from "@/shared/utils/formatting";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  subtitle?: string;
  trend?: string | number | null;
  valueClassName?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  layout?: 'default' | 'side-icon';
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  className,
  valueClassName,
  titleClassName,
  subtitleClassName,
  layout = 'side-icon',
  ...props
}: StatCardProps) {
  if (layout === 'side-icon') {
    return (
      <div
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0a0a0a]",
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className={cn("text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-gray-500", titleClassName)}>
              {title}
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn("text-3xl font-black tabular-nums text-slate-950 dark:text-white", valueClassName)}>
                {value}
              </span>
              {trend != null && (
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    Number(trend) >= 0 ? "text-emerald-500" : "text-red-500"
                  )}
                >
                  {Number(trend) >= 0 ? `+${trend}%` : `${trend}%`}
                </span>
              )}
            </div>
            {subtitle && (
              <p className={cn("mt-1 text-xs font-medium text-slate-500 dark:text-gray-500", subtitleClassName)}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div className="shrink-0">{icon}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0a0a0a]",
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-white/50", titleClassName)}>
          {title}
        </span>
        {icon && <div className="shrink-0">{icon}</div>}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className={cn("text-xl font-black tabular-nums tracking-tight text-slate-950 dark:text-white sm:text-2xl", valueClassName)}>
          {value}
        </span>
        {trend != null && (
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              Number(trend) >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {Number(trend) >= 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
      {subtitle && (
        <p className={cn("mt-1 text-xs font-medium text-slate-500 dark:text-white/60", subtitleClassName)}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
