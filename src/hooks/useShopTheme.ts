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

interface ThemeDefinition {
    classes: ThemeClasses;
    vars: Record<string, string>;
}

const THEME_DEFINITIONS: Record<Theme, ThemeDefinition> = {
    black: {
        classes: {
            bgGradient: 'from-black to-[#0a0a0a]',
            textColor: 'text-white',
            buttonGradient: 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600',
            cardBg: 'bg-[#0a0a0a]/80',
            accentColor: 'text-yellow-400',
            borderColor: 'border-white/10'
        },
        vars: {
            '--theme-bg-color': '#000000',
            '--theme-text': '#ffffff',
            '--theme-card-bg': 'rgba(10, 10, 10, 0.98)',
            '--theme-accent': '#f59e0b',
            '--theme-accent-rgb': '245, 158, 11',
            '--theme-border': 'rgba(255, 255, 255, 0.1)',
            '--theme-button-bg': '#f59e0b',
            '--theme-button-text': '#000000',
        }
    },
    pink: {
        classes: {
            bgGradient: 'from-pink-50 to-white',
            textColor: 'text-pink-900',
            buttonGradient: 'from-pink-500 to-pink-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-pink-600',
            borderColor: 'border-pink-200'
        },
        vars: {
            '--theme-bg-color': '#fdf2f8',
            '--theme-text': '#831843',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#db2777',
            '--theme-accent-rgb': '219, 39, 119',
            '--theme-border': 'rgba(251, 207, 232, 0.5)',
            '--theme-button-bg': '#db2777',
            '--theme-button-text': '#ffffff',
        }
    },
    orange: {
        classes: {
            bgGradient: 'from-orange-50 to-white',
            textColor: 'text-orange-900',
            buttonGradient: 'from-orange-500 to-orange-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-orange-600',
            borderColor: 'border-orange-200'
        },
        vars: {
            '--theme-bg-color': '#fff7ed',
            '--theme-text': '#7c2d12',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#ea580c',
            '--theme-accent-rgb': '234, 88, 12',
            '--theme-border': 'rgba(254, 215, 170, 0.5)',
            '--theme-button-bg': '#ea580c',
            '--theme-button-text': '#ffffff',
        }
    },
    green: {
        classes: {
            bgGradient: 'from-green-50 to-white',
            textColor: 'text-green-900',
            buttonGradient: 'from-green-500 to-green-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-green-600',
            borderColor: 'border-green-200'
        },
        vars: {
            '--theme-bg-color': '#f0fdf4',
            '--theme-text': '#166534',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#16a34a',
            '--theme-accent-rgb': '22, 163, 74',
            '--theme-border': 'rgba(187, 247, 208, 0.5)',
            '--theme-button-bg': '#16a34a',
            '--theme-button-text': '#ffffff',
        }
    },
    red: {
        classes: {
            bgGradient: 'from-red-50 to-white',
            textColor: 'text-red-900',
            buttonGradient: 'from-red-500 to-red-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-red-600',
            borderColor: 'border-red-200'
        },
        vars: {
            '--theme-bg-color': '#fef2f2',
            '--theme-text': '#991b1b',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#dc2626',
            '--theme-accent-rgb': '220, 38, 38',
            '--theme-border': 'rgba(254, 202, 202, 0.5)',
            '--theme-button-bg': '#dc2626',
            '--theme-button-text': '#ffffff',
        }
    },
    yellow: {
        classes: {
            bgGradient: 'from-yellow-50 to-white',
            textColor: 'text-yellow-900',
            buttonGradient: 'from-yellow-400 to-yellow-500',
            cardBg: 'bg-white/60',
            accentColor: 'text-yellow-600',
            borderColor: 'border-yellow-200'
        },
        vars: {
            '--theme-bg-color': '#fefce8',
            '--theme-text': '#713f12',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#ca8a04',
            '--theme-accent-rgb': '202, 138, 4',
            '--theme-border': 'rgba(254, 240, 138, 0.5)',
            '--theme-button-bg': '#ca8a04',
            '--theme-button-text': '#ffffff',
        }
    },
    brown: {
        classes: {
            bgGradient: 'from-[#fdf8f6] to-white',
            textColor: 'text-[#451a03]',
            buttonGradient: 'from-[#78350f] to-[#92400e]',
            cardBg: 'bg-white/60',
            accentColor: 'text-[#92400e]',
            borderColor: 'border-[#f3e3d3]'
        },
        vars: {
            '--theme-bg-color': '#fffbeb',
            '--theme-text': '#451a03',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#92400e',
            '--theme-accent-rgb': '146, 64, 14',
            '--theme-border': 'rgba(251, 235, 198, 0.5)',
            '--theme-button-bg': '#92400e',
            '--theme-button-text': '#ffffff',
        }
    },
    default: {
        classes: {
            bgGradient: 'from-gray-50 to-white',
            textColor: 'text-gray-900',
            buttonGradient: 'from-yellow-400 to-yellow-500',
            cardBg: 'bg-white/60',
            accentColor: 'text-yellow-600',
            borderColor: 'border-gray-200'
        },
        vars: {
            '--theme-bg-color': '#f9fafb',
            '--theme-text': '#111827',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#f59e0b',
            '--theme-accent-rgb': '245, 158, 11',
            '--theme-border': 'rgba(229, 231, 235, 0.5)',
            '--theme-button-bg': '#f59e0b',
            '--theme-button-text': '#ffffff',
        }
    }
};

export function useShopTheme(themeName: Theme = 'black') {
    const config = useMemo(() => THEME_DEFINITIONS[themeName] || THEME_DEFINITIONS.black, [themeName]);

    useEffect(() => {
        const root = document.documentElement;
        const currentVars = config.vars;

        Object.entries(currentVars).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        return () => {
            Object.keys(currentVars).forEach((key) => {
                root.style.removeProperty(key);
            });
        };
    }, [config]);

    return config.classes;
}
