import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { sellerApi, Theme } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';

const themeColors = [
  { name: 'Default', value: 'default', bg: 'bg-gradient-to-br from-yellow-400 to-yellow-500' },
  { name: 'Black', value: 'black', bg: 'bg-gradient-to-br from-gray-800 to-gray-900' },
  { name: 'Pink', value: 'pink', bg: 'bg-gradient-to-br from-pink-400 to-pink-500' },
  { name: 'Orange', value: 'orange', bg: 'bg-gradient-to-br from-orange-400 to-orange-500' },
  { name: 'Green', value: 'green', bg: 'bg-gradient-to-br from-green-400 to-green-500' },
  { name: 'Red', value: 'red', bg: 'bg-gradient-to-br from-red-400 to-red-500' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-gradient-to-br from-yellow-300 to-yellow-400' },
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
          <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-black">Shop Theme</h3>
        </div>
        <p className="text-xs sm:text-sm text-gray-500 flex-1 sm:flex-none">
          Choose a color theme for your shop. This will affect the appearance of your shop page.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => handleThemeSelect(theme.value as Theme)}
            className={`relative h-16 sm:h-20 lg:h-24 rounded-lg sm:rounded-xl overflow-hidden border-2 transition-all ${
              selectedTheme === theme.value
                ? 'ring-2 ring-offset-2 ring-yellow-500 scale-105'
                : 'border-gray-200 hover:border-gray-300 hover:scale-102'
            }`}
          >
            <div className={`w-full h-full ${theme.bg} flex items-center justify-center`}>
              {selectedTheme === theme.value && (
                <div className="absolute top-1 sm:top-2 right-1 sm:right-2 bg-white rounded-full p-0.5 sm:p-1 shadow-sm">
                  <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                </div>
              )}
              <span className="text-white font-medium text-xs sm:text-sm">{theme.name}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2 sm:pt-4 flex justify-center sm:justify-start">
        <Button
          onClick={saveTheme}
          disabled={isSaving || selectedTheme === currentTheme}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base"
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
