import { Input } from '@/components/ui/input';

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">{title}</h3>
      <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">{description}</p>
    </div>
  );
}

interface SocialInputProps {
  displayValue?: string;
  iconPath: React.ReactNode;
  isEditing: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

export function SocialInput({ displayValue, iconPath, isEditing, label, onChange, placeholder, value }: SocialInputProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs sm:text-sm font-medium text-slate-600 mb-1">{label}</p>
      {isEditing ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 text-xs sm:text-sm bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-yellow-400 focus:ring-yellow-400"
        />
      ) : (
        <div className="flex items-center gap-2">
          {displayValue ? (
            <a
              href={displayValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-base lg:text-lg font-semibold text-blue-700 hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {iconPath}
              </svg>
              View
            </a>
          ) : (
            <p className="text-sm sm:text-base font-semibold text-slate-500 italic">Not set</p>
          )}
        </div>
      )}
    </div>
  );
}
