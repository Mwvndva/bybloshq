import { Trash2 } from 'lucide-react';
import { Input } from '@/shared/ui/input';

export function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h3 className="text-base font-black tracking-tight text-white sm:text-lg">{title}</h3>
        <p className="mt-1 seller-subtext">{description}</p>
      </div>
      {action && <div className="self-start sm:self-auto shrink-0">{action}</div>}
    </div>
  );
}

interface SocialInputProps {
  displayValue?: string;
  iconPath: React.ReactNode;
  isEditing: boolean;
  label: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  placeholder: string;
  value: string;
}

export function SocialInput({ displayValue, iconPath, isEditing, label, onChange, onRemove, placeholder, value }: SocialInputProps) {
  return (
    <div className="seller-card-soft p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="seller-label">{label}</p>
        {isEditing && value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
            title={`Remove ${label}`}
          >
            <Trash2 className="h-3 w-3" /> Remove
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="seller-field text-xs sm:text-sm"
        />
      ) : (
        <div className="flex items-center justify-between gap-2">
          {displayValue ? (
            <>
              <a
                href={displayValue}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm sm:text-base lg:text-lg font-semibold text-[var(--theme-accent,#f5c518)] hover:underline flex items-center gap-1.5 truncate max-w-[calc(100%-80px)]"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {iconPath}
                </svg>
                View
              </a>
              {onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                  title={`Remove ${label}`}
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              )}
            </>
          ) : (
            <p className="text-sm sm:text-base font-semibold text-white/40 italic">Not set</p>
          )}
        </div>
      )}
    </div>
  );
}
