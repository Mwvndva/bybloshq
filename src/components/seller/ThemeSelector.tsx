import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette } from 'lucide-react';
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center">
          <Palette className="h-5 w-5 mr-2" />
          Shop Theme
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Choose a color theme for your shop. This will affect the appearance of your shop page.
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {themeColors.map((theme) => (
          <button
            key={theme.value}
            type="button"
            onClick={() => handleThemeSelect(theme.value as Theme)}
            className={`relative h-24 rounded-lg overflow-hidden border-2 transition-all ${
              selectedTheme === theme.value ? 'ring-2 ring-offset-2 ring-yellow-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className={`w-full h-full ${theme.bg} flex items-center justify-center`}>
              {selectedTheme === theme.value && (
                <div className="absolute top-2 right-2 bg-white rounded-full p-1">
                  <Check className="h-4 w-4 text-green-500" />
                </div>
              )}
              <span className="text-white font-medium text-sm">{theme.name}</span>
            </div>
          </button>
        ))}
      </div>
      
      <div className="pt-2">
        <Button
          onClick={saveTheme}
          disabled={isSaving || selectedTheme === currentTheme}
          className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
        >
          {isSaving ? 'Saving...' : 'Save Theme'}
        </Button>
      </div>
    </div>
  );
};

export default ThemeSelector;
