import { useEffect, useMemo } from 'react';

export type Theme = 'default' | 'black' | 'pink' | 'orange' | 'green' | 'red' | 'yellow' | 'brown';

export interface ThemeClasses {
    bgGradient: string;
    textColor: string;
    buttonGradient: string;
    cardBg: string;
    accentColor: string;
    borderColor: string;
}

export function useShopTheme(themeName: Theme = 'black') {
    const themeClasses = useMemo((): ThemeClasses => {
        switch (themeName) {
            case 'black':
                return {
                    bgGradient: 'from-black to-[#0a0a0a]',
                    textColor: 'text-white',
                    buttonGradient: 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600',
                    cardBg: 'bg-[#0a0a0a]/80',
                    accentColor: 'text-yellow-400',
                    borderColor: 'border-white/10'
                };
            case 'pink':
                return {
                    bgGradient: 'from-pink-50 to-white',
                    textColor: 'text-pink-900',
                    buttonGradient: 'from-pink-500 to-pink-600',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-pink-600',
                    borderColor: 'border-pink-200'
                };
            case 'orange':
                return {
                    bgGradient: 'from-orange-50 to-white',
                    textColor: 'text-orange-900',
                    buttonGradient: 'from-orange-500 to-orange-600',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-orange-600',
                    borderColor: 'border-orange-200'
                };
            case 'green':
                return {
                    bgGradient: 'from-green-50 to-white',
                    textColor: 'text-green-900',
                    buttonGradient: 'from-green-500 to-green-600',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-green-600',
                    borderColor: 'border-green-200'
                };
            case 'red':
                return {
                    bgGradient: 'from-red-50 to-white',
                    textColor: 'text-red-900',
                    buttonGradient: 'from-red-500 to-red-600',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-red-600',
                    borderColor: 'border-red-200'
                };
            case 'yellow':
                return {
                    bgGradient: 'from-yellow-50 to-white',
                    textColor: 'text-yellow-900',
                    buttonGradient: 'from-yellow-400 to-yellow-500',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-yellow-600',
                    borderColor: 'border-yellow-200'
                };
            case 'brown':
                return {
                    bgGradient: 'from-[#fdf8f6] to-white',
                    textColor: 'text-[#451a03]',
                    buttonGradient: 'from-[#78350f] to-[#92400e]',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-[#92400e]',
                    borderColor: 'border-[#f3e3d3]'
                };
            default:
                return {
                    bgGradient: 'from-gray-50 to-white',
                    textColor: 'text-gray-900',
                    buttonGradient: 'from-yellow-400 to-yellow-500',
                    cardBg: 'bg-white/60',
                    accentColor: 'text-yellow-600',
                    borderColor: 'border-gray-200'
                };
        }
    }, [themeName]);

    useEffect(() => {
        const root = document.documentElement;
        const properties: Record<string, string> = {};

        switch (themeName) {
            case 'black':
                properties['--theme-bg-color'] = '#000000';
                properties['--theme-text'] = '#ffffff';
                properties['--theme-card-bg'] = 'rgba(10, 10, 10, 0.98)';
                properties['--theme-accent'] = '#f59e0b';
                properties['--theme-accent-rgb'] = '245, 158, 11';
                properties['--theme-border'] = 'rgba(255, 255, 255, 0.1)';
                properties['--theme-button-bg'] = '#f59e0b';
                properties['--theme-button-text'] = '#000000';
                break;
            case 'pink':
                properties['--theme-bg-color'] = '#fdf2f8';
                properties['--theme-text'] = '#831843';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#db2777';
                properties['--theme-accent-rgb'] = '219, 39, 119';
                properties['--theme-border'] = 'rgba(251, 207, 232, 0.5)';
                properties['--theme-button-bg'] = '#db2777';
                properties['--theme-button-text'] = '#ffffff';
                break;
            case 'orange':
                properties['--theme-bg-color'] = '#fff7ed';
                properties['--theme-text'] = '#7c2d12';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#ea580c';
                properties['--theme-accent-rgb'] = '234, 88, 12';
                properties['--theme-border'] = 'rgba(254, 215, 170, 0.5)';
                properties['--theme-button-bg'] = '#ea580c';
                properties['--theme-button-text'] = '#ffffff';
                break;
            case 'green':
                properties['--theme-bg-color'] = '#f0fdf4';
                properties['--theme-text'] = '#166534';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#16a34a';
                properties['--theme-accent-rgb'] = '22, 163, 74';
                properties['--theme-border'] = 'rgba(187, 247, 208, 0.5)';
                properties['--theme-button-bg'] = '#16a34a';
                properties['--theme-button-text'] = '#ffffff';
                break;
            case 'red':
                properties['--theme-bg-color'] = '#fef2f2';
                properties['--theme-text'] = '#991b1b';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#dc2626';
                properties['--theme-accent-rgb'] = '220, 38, 38';
                properties['--theme-border'] = 'rgba(254, 202, 202, 0.5)';
                properties['--theme-button-bg'] = '#dc2626';
                properties['--theme-button-text'] = '#ffffff';
                break;
            case 'yellow':
                properties['--theme-bg-color'] = '#fefce8';
                properties['--theme-text'] = '#713f12';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#ca8a04';
                properties['--theme-accent-rgb'] = '202, 138, 4';
                properties['--theme-border'] = 'rgba(254, 240, 138, 0.5)';
                properties['--theme-button-bg'] = '#ca8a04';
                properties['--theme-button-text'] = '#ffffff';
                break;
            case 'brown':
                properties['--theme-bg-color'] = '#fffbeb';
                properties['--theme-text'] = '#451a03';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#92400e';
                properties['--theme-accent-rgb'] = '146, 64, 14';
                properties['--theme-border'] = 'rgba(251, 235, 198, 0.5)';
                properties['--theme-button-bg'] = '#92400e';
                properties['--theme-button-text'] = '#ffffff';
                break;
            default:
                properties['--theme-bg-color'] = '#f9fafb';
                properties['--theme-text'] = '#111827';
                properties['--theme-card-bg'] = 'rgba(255, 255, 255, 0.95)';
                properties['--theme-accent'] = '#f59e0b';
                properties['--theme-accent-rgb'] = '245, 158, 11';
                properties['--theme-border'] = 'rgba(229, 231, 235, 0.5)';
                properties['--theme-button-bg'] = '#f59e0b';
                properties['--theme-button-text'] = '#ffffff';
        }

        Object.entries(properties).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        return () => {
            Object.keys(properties).forEach((key) => {
                root.style.removeProperty(key);
            });
        };
    }, [themeName]);

    return themeClasses;
}
