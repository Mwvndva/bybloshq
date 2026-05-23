import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { sellerApi, Theme } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';

const themeColors = [
  { name: 'White', value: 'default', swatchClass: 'bg-white' },
  { name: 'Black', value: 'black', swatchClass: 'bg-slate-950' },
  { name: 'Pink', value: 'pink', swatchClass: 'bg-pink-500' },
  { name: 'Brown', value: 'brown', swatchClass: 'bg-amber-800' },
  { name: 'Orange', value: 'orange', swatchClass: 'bg-orange-500' },
  { name: 'Green', value: 'green', swatchClass: 'bg-emerald-500' },
  { name: 'Red', value: 'red', swatchClass: 'bg-red-500' },
  { name: 'Yellow', value: 'yellow', swatchClass: 'bg-yellow-400' },
];

interface ThemeSelectorProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export const ThemeSelector = ({ currentTheme = 'default', onThemeChange }: ThemeSelectorProps) => {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(currentTheme);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSelectedTheme(currentTheme);
  }, [currentTheme]);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
  };

  const saveTheme = async () => {
    try {
      setIsSaving(true);
      await sellerApi.updateTheme(selectedTheme);

      if (onThemeChange) {
        onThemeChange(selectedTheme);
      }

      toast({
        title: 'Theme updated',
        description: `Your shop theme has been updated to ${selectedTheme}.`,
      });
    } catch (error) {
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
            <div className={`relative h-14 w-full overflow-hidden rounded-xl border border-slate-200 shadow-inner sm:h-16 ${theme.swatchClass}`}>
              {selectedTheme === theme.value && (
                <div
                  className="absolute top-2 right-2 rounded-full p-1 shadow-lg animate-in zoom-in duration-200"
                  style={{ background: '#ffffff' }}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/5" />
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
