import { useEffect, useMemo, type RefObject } from 'react';
import type { Theme } from '@/shared/types';

export type { Theme };

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
    purple: {
        classes: {
            bgGradient: 'from-purple-50 to-white',
            textColor: 'text-purple-900',
            buttonGradient: 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700',
            cardBg: 'bg-white/60',
            accentColor: 'text-purple-600',
            borderColor: 'border-purple-200'
        },
        vars: {
            '--theme-bg-color': '#faf5ff',
            '--theme-text': '#581c87',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#a855f7',
            '--theme-accent-rgb': '168, 85, 247',
            '--theme-border': 'rgba(233, 213, 255, 0.5)',
            '--theme-button-bg': '#a855f7',
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
            bgGradient: 'from-emerald-50 to-white',
            textColor: 'text-emerald-900',
            buttonGradient: 'from-emerald-500 to-emerald-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-emerald-600',
            borderColor: 'border-emerald-200'
        },
        vars: {
            '--theme-bg-color': '#ecfdf5',
            '--theme-text': '#064e3b',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#059669',
            '--theme-accent-rgb': '5, 150, 105',
            '--theme-border': 'rgba(167, 243, 208, 0.5)',
            '--theme-button-bg': '#059669',
            '--theme-button-text': '#ffffff',
        }
    },
    red: {
        classes: {
            bgGradient: 'from-rose-50 to-white',
            textColor: 'text-rose-900',
            buttonGradient: 'from-rose-500 to-rose-600',
            cardBg: 'bg-white/60',
            accentColor: 'text-rose-600',
            borderColor: 'border-rose-200'
        },
        vars: {
            '--theme-bg-color': '#fff1f2',
            '--theme-text': '#881337',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#e11d48',
            '--theme-accent-rgb': '225, 29, 72',
            '--theme-border': 'rgba(254, 205, 211, 0.5)',
            '--theme-button-bg': '#e11d48',
            '--theme-button-text': '#ffffff',
        }
    },
    yellow: {
        classes: {
            bgGradient: 'from-amber-50 to-white',
            textColor: 'text-amber-950',
            buttonGradient: 'from-amber-400 to-amber-500 text-black',
            cardBg: 'bg-white/60',
            accentColor: 'text-amber-600',
            borderColor: 'border-amber-200'
        },
        vars: {
            '--theme-bg-color': '#fffbeb',
            '--theme-text': '#451a03',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#d97706',
            '--theme-accent-rgb': '217, 119, 6',
            '--theme-border': 'rgba(253, 230, 138, 0.5)',
            '--theme-button-bg': '#d97706',
            '--theme-button-text': '#ffffff',
        }
    },
    brown: {
        classes: {
            bgGradient: 'from-stone-100 to-stone-50',
            textColor: 'text-stone-900',
            buttonGradient: 'from-stone-700 to-stone-800 text-white',
            cardBg: 'bg-white/70',
            accentColor: 'text-stone-700',
            borderColor: 'border-stone-300'
        },
        vars: {
            '--theme-bg-color': '#f5f5f4',
            '--theme-text': '#1c1917',
            '--theme-card-bg': 'rgba(255, 255, 255, 0.95)',
            '--theme-accent': '#44403c',
            '--theme-accent-rgb': '68, 64, 60',
            '--theme-border': 'rgba(214, 211, 209, 0.5)',
            '--theme-button-bg': '#44403c',
            '--theme-button-text': '#ffffff',
        }
    },
    default: {
        classes: {
            bgGradient: 'from-black to-[#0a0a0a]',
            textColor: 'text-white',
            buttonGradient: 'bg-yellow-400 text-black hover:bg-yellow-300',
            cardBg: 'bg-[#0a0a0a]',
            accentColor: 'text-yellow-400',
            borderColor: 'border-white/10'
        },
        vars: {
            '--theme-bg-color': '#000000',
            '--theme-text': '#ffffff',
            '--theme-card-bg': 'rgba(10, 10, 10, 0.98)',
            '--theme-accent': '#f5c518',
            '--theme-accent-rgb': '245, 197, 24',
            '--theme-border': 'rgba(255, 255, 255, 0.1)',
            '--theme-button-bg': '#f5c518',
            '--theme-button-text': '#000000',
        }
    }
};

export function useShopTheme(
    themeName: Theme = 'default',
    targetRef?: RefObject<HTMLElement | null>
) {
    const config = useMemo(() => THEME_DEFINITIONS[themeName] || THEME_DEFINITIONS.default, [themeName]);

    useEffect(() => {
        const targetElement = targetRef?.current || document.documentElement;
        const currentVars = config.vars;

        Object.entries(currentVars).forEach(([key, value]) => {
            targetElement.style.setProperty(key, value);
        });

        return () => {
            Object.keys(currentVars).forEach((key) => {
                targetElement.style.removeProperty(key);
            });
        };
    }, [config, targetRef]);

    return config.classes;
}

// ─── Accent-only variant ─────────────────────────────────────────────────────
const ACCENT_KEYS = ['--theme-accent', '--theme-accent-rgb', '--theme-button-bg', '--theme-button-text'] as const;

export function useShopAccentOnly(
    themeName: Theme = 'default',
    targetRef?: RefObject<HTMLElement | null>
) {
    const config = useMemo(() => THEME_DEFINITIONS[themeName] || THEME_DEFINITIONS.default, [themeName]);

    useEffect(() => {
        const targetElement = targetRef?.current || document.documentElement;
        const vars = config.vars;

        ACCENT_KEYS.forEach((key) => {
            if (vars[key]) targetElement.style.setProperty(key, vars[key]);
        });

        return () => {
            ACCENT_KEYS.forEach((key) => targetElement.style.removeProperty(key));
        };
    }, [config, targetRef]);

    return config.classes;
}
