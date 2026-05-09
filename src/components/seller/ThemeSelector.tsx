import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { sellerApi, Theme } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';

const themeColors = [
  { name: 'White', value: 'default', preview: '#ffffff', labelColor: '#111827', labelBg: 'rgba(17, 24, 39, 0.10)' },
  { name: 'Black', value: 'black', preview: 'linear-gradient(135deg, #1f2937 0%, #030712 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.16)' },
  { name: 'Pink', value: 'pink', preview: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.24)' },
  { name: 'Brown', value: 'brown', preview: 'linear-gradient(135deg, #b45309 0%, #7c2d12 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.20)' },
  { name: 'Orange', value: 'orange', preview: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.20)' },
  { name: 'Green', value: 'green', preview: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.20)' },
  { name: 'Red', value: 'red', preview: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)', labelColor: '#ffffff', labelBg: 'rgba(255, 255, 255, 0.20)' },
  { name: 'Yellow', value: 'yellow', preview: 'linear-gradient(135deg, #fde047 0%, #facc15 100%)', labelColor: '#111827', labelBg: 'rgba(17, 24, 39, 0.10)' },
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl shadow-lg">
          <Palette className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Shop Theme</h3>
          <p className="text-xs sm:text-sm text-gray-900 mt-0.5">Choose a color theme for your shop page</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => handleThemeSelect(theme.value as Theme)}
            className={`relative group h-20 sm:h-24 lg:h-28 rounded-xl overflow-hidden border-2 transition-all duration-300 shadow-md hover:shadow-lg ${selectedTheme === theme.value
              ? 'ring-2 ring-offset-2 ring-yellow-500 scale-105 border-yellow-400'
              : 'border-gray-200 hover:border-gray-300 hover:scale-105'
              }`}
          >
            <div
              className="w-full h-full flex flex-col items-center justify-center relative"
              style={{ background: theme.preview }}
            >
              {selectedTheme === theme.value && (
                <div
                  className="absolute top-2 right-2 rounded-full p-1 shadow-lg animate-in zoom-in duration-200"
                  style={{ background: '#ffffff' }}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
              <span
                className="font-bold text-xs sm:text-sm px-2 py-0.5 rounded-full"
                style={{ color: theme.labelColor, background: theme.labelBg }}
              >
                {theme.name}
              </span>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2 sm:pt-4 flex justify-center sm:justify-start">
        <Button
          onClick={saveTheme}
          disabled={isSaving || selectedTheme === currentTheme}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-6 py-3 text-sm font-bold shadow-lg hover:shadow-xl transition-all"
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
