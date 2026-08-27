import { useState, useEffect } from 'react';
import { Button } from '@/shared/ui/button';
import { Palette, Loader2 } from 'lucide-react';
import type { Theme } from '@/features/seller/api';
import { useUpdateThemeMutation } from '@/features/seller/hooks/useSellerProfile';
import { useToast } from '@/shared/hooks/use-toast';

const themeColors: { name: string; value: Theme; color: string }[] = [
  { name: 'Default', value: 'default', color: '#f5c518' },
  { name: 'Black', value: 'black', color: '#000000' },
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

export const ThemeSelector = ({ currentTheme = 'default', onThemeChange }: ThemeSelectorProps) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(currentTheme || 'default');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedTheme(currentTheme || 'default');
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-[var(--theme-accent,#f5c518)]/30 bg-[var(--theme-accent,#f5c518)]/15 p-2">
          <Palette className="h-5 w-5 text-[var(--theme-accent,#f5c518)]" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-slate-950 dark:text-white sm:text-lg">Shop Theme</h3>
          <p className="mt-0.5 seller-subtext">Choose a color theme for your shop page</p>
        </div>
      </div>

      <div
        role="radiogroup"
        aria-label="Shop theme color presets"
        className="flex items-center gap-1.5 sm:gap-2 flex-wrap py-1"
      >
        {themeColors.map((theme) => {
          const isSelected = selectedTheme === theme.value;
          return (
            <button
              key={theme.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Select ${theme.name} theme`}
              title={theme.name}
              onClick={() => handleThemeSelect(theme.value)}
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
            >
              <span
                className={`block rounded-full transition-all duration-200 ${
                  isSelected
                    ? 'h-4 w-4 ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#161616] border border-black/10 dark:border-white/20 shadow-sm scale-110'
                    : 'h-3.5 w-3.5 border border-black/15 dark:border-white/25 hover:scale-125 opacity-90 hover:opacity-100'
                }`}
                style={{ backgroundColor: theme.color }}
              />
            </button>
          );
        })}
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
