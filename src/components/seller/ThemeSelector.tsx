import { useState, useEffect, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { Theme } from '@/api/seller';
import { useUpdateThemeMutation } from '@/hooks/seller/useSellerProfile';
import { useToast } from '@/hooks/use-toast';

const themeColors = [
  { name: 'Yellow', value: 'yellow', color: '#facc15' },
  { name: 'Pink', value: 'pink', color: '#ec4899' },
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
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-2">
          <Palette className="h-5 w-5 text-yellow-700" />
        </div>
        <div>
          <h3 className="text-base font-black tracking-tight text-slate-950 sm:text-lg">Shop Theme</h3>
          <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">Choose a color theme for your shop page</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => handleThemeSelect(theme.value as Theme)}
            className={`relative group h-24 rounded-2xl border bg-white p-2 transition-all duration-200 sm:h-28 ${selectedTheme === theme.value
              ? 'border-yellow-400 ring-2 ring-yellow-300/30 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
          >
            <div
              className="theme-swatch relative h-14 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner sm:h-16"
              style={{ '--theme-swatch-color': theme.color } as CSSProperties}
            >
              {selectedTheme === theme.value && (
                <div
                  className="absolute top-2 right-2 rounded-full p-1 shadow-lg animate-in zoom-in duration-200"
                  style={{ background: '#ffffff' }}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-transparent transition-colors duration-200 group-hover:bg-slate-950/5" />
            </div>
            <span className="mt-2 block text-center text-xs font-bold text-slate-700 sm:text-sm">
              {theme.name}
            </span>
          </button>
        ))}
      </div>

      <div className="flex justify-start pt-1">
        <Button
          onClick={saveTheme}
          disabled={isSaving || selectedTheme === currentTheme}
          className="h-10 w-full bg-yellow-400 px-6 text-sm font-black text-black hover:bg-yellow-300 sm:w-auto"
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


