import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette, Loader2 } from 'lucide-react';
import { sellerApi, Theme } from '@/api/sellerApi';
import { useToast } from '@/components/ui/use-toast';

const themeColors = [
  { name: 'White', value: 'default', bg: 'bg-white' },
  { name: 'Black', value: 'black', bg: 'bg-gradient-to-br from-gray-800 to-gray-900' },
  { name: 'Pink', value: 'pink', bg: 'bg-gradient-to-br from-pink-400 to-pink-500' },
  { name: 'Brown', value: 'brown', bg: 'bg-gradient-to-br from-amber-700 to-amber-800' },
  { name: 'Orange', value: 'orange', bg: 'bg-gradient-to-br from-orange-400 to-orange-500' },
  { name: 'Green', value: 'green', bg: 'bg-gradient-to-br from-green-400 to-green-500' },
  { name: 'Red', value: 'red', bg: 'bg-gradient-to-br from-red-400 to-red-500' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-gradient-to-br from-yellow-300 to-yellow-400' },
];

interface ThemeSelectorProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export const ThemeSelector = ({ currentTheme = 'black', onThemeChange }: ThemeSelectorProps) => {
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
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Choose a color theme for your shop page</p>
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
            <div className={`w-full h-full ${theme.bg} flex flex-col items-center justify-center relative`}>
              {selectedTheme === theme.value && (
                <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg animate-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              )}
              <span
                className={`${theme.value === 'default' ? 'text-gray-900' : 'text-white'} font-bold text-xs sm:text-sm ${theme.value === 'default' ? '' : 'drop-shadow-md'}`}
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
