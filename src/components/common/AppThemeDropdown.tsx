import React from 'react';
import { Monitor, Moon, Sun, ChevronDown, Check } from 'lucide-react';
import { useAppTheme, type AppTheme } from '@/hooks/useAppTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AppThemeDropdown({ className }: { className?: string }) {
  const { theme, setTheme } = useAppTheme();

  const OPTIONS: { value: AppTheme; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'system', label: 'System', Icon: Monitor },
    { value: 'light',  label: 'Light',  Icon: Sun },
    { value: 'dark',   label: 'Dark',   Icon: Moon },
  ];

  const activeOption = OPTIONS.find(o => o.value === theme) || OPTIONS[2];
  const ActiveIcon = activeOption.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white/90 dark:bg-white/[0.06] px-3 text-xs font-bold text-slate-800 dark:text-white shadow-sm hover:bg-slate-100 dark:hover:bg-white/10 transition-all duration-200 outline-none ${className || ''}`}
        aria-label="Select App Theme"
      >
        <ActiveIcon className="h-4 w-4 text-[#F5C518]" />
        <span className="capitalize">{activeOption.label}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-36 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0d0d0d] p-1.5 text-slate-900 dark:text-white shadow-2xl backdrop-blur-md z-50"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className={`flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold cursor-pointer transition-colors ${
                active
                  ? 'bg-yellow-400 text-black font-extrabold focus:bg-yellow-400 focus:text-black'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 focus:bg-slate-100 dark:focus:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-black' : 'text-slate-500 dark:text-white/60'}`} />
                <span>{label}</span>
              </div>
              {active && <Check className="h-3.5 w-3.5 text-black stroke-[3]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
