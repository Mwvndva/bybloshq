import { useState, useEffect, type CSSProperties } from 'react';
import { Button } from '@/shared/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { Theme } from '@/features/seller/api';
import { useUpdateThemeMutation } from '@/features/seller/hooks/useSellerProfile';
import { useToast } from '@/shared/hooks/use-toast';

const themeColors = [
  { name: 'Yellow', value: 'yellow', color: '#facc15' },
  { name: 'Pink', value: 'pink', color: '#ec4899' },
  { name: 'Purple', value: 'purple', color: '#a855f7' },
  { name: 'Brown', value: 'brown', color: '#92400e' },
  { name: 'Orange', value: 'orange', color: '#f97316' },
  { name: 'Green', value: 'green', color: '#10b981' },
  { name: 'Red', value: 'red', color: '#ef4444' },
];

interface ThemeSelectorProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export const ThemeSelector = ({ currentTheme = 'yellow', onThemeChange }: ThemeSelectorProps) => {
  const initialTheme = (currentTheme === 'default' || currentTheme === 'black') ? 'yellow' : currentTheme;
  const [selectedTheme, setSelectedTheme] = useState<Theme>(initialTheme);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const validTheme = (currentTheme === 'default' || currentTheme === 'black') ? 'yellow' : currentTheme;
    setSelectedTheme(validTheme);
  }, [currentTheme]);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
  };

  const updateThemeMutation = useUpdateThemeMutation();

  const saveTheme = async () => {
    try {
      setIsSaving(true);
      await updateThemeMutation.mutateAsync(selectedTheme);

      if (onThemeChange) {
        onThemeChange(selectedTheme);
      }

      toast({
        title: 'Theme updated',
        description: `Your shop theme has been updated to ${selectedTheme}.`,
      });
    } catch (error: unknown) {
      console.error('Error updating theme:', error);
      toast({
        title: 'Error',
        description: 'Failed to update theme. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-[var(--theme-accent,#f5c518)]/30 bg-[var(--theme-accent,#f5c518)]/15 p-2">
          <Palette className="h-5 w-5 text-[var(--theme-accent,#f5c518)]" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-white sm:text-lg">Shop Theme</h3>
          <p className="mt-1 seller-subtext">Choose a color theme for your shop page</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => handleThemeSelect(theme.value as Theme)}
            className={`relative group h-24 rounded-2xl border p-2 transition-all duration-200 sm:h-28 ${selectedTheme === theme.value
              ? 'border-[var(--theme-accent,#f5c518)] bg-[var(--theme-accent,#f5c518)]/15 ring-2 ring-[var(--theme-accent,#f5c518)]/30'
              : 'border-white/10 bg-white/[0.04] hover:border-white/20'
              }`}
          >
            <div
              className="theme-swatch relative h-14 w-full overflow-hidden rounded-xl border border-white/10 shadow-inner sm:h-16"
              style={{ backgroundColor: theme.color, '--theme-swatch-color': theme.color } as CSSProperties}
            >
              {selectedTheme === theme.value && (
                <div
                  className="absolute top-2 right-2 rounded-full p-1 shadow-lg animate-in zoom-in duration-200"
                  style={{ background: '#ffffff' }}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-transparent transition-colors duration-200 group-hover:bg-black/10" />
            </div>
            <span className="mt-2 block text-center text-xs font-bold text-white/60 sm:text-sm">
              {theme.name}
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-start pt-1">
        <Button
          onClick={saveTheme}
          disabled={isSaving || selectedTheme === currentTheme}
          className="h-10 w-full bg-[var(--theme-button-bg,#f5c518)] px-6 text-sm font-black text-[var(--theme-button-text,#000000)] hover:opacity-90 sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Theme'
          )}
        </Button>
      </div>
    </div>
  );
};

export default ThemeSelector;


