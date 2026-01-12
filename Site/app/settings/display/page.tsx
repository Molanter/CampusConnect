'use client';

import { useEffect, useState } from 'react';
import { ChevronLeftIcon, SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { SettingsFooter } from '@/components/settings-footer';

type Theme = 'light' | 'dark' | 'system';

export default function DisplayPage() {
    const [currentTheme, setCurrentTheme] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);

        // Get the saved theme from localStorage
        const saved = localStorage.getItem('theme-preference') as Theme | null;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
            setCurrentTheme(saved);
        } else {
            setCurrentTheme('system');
        }

        // Detect system theme
        const actualTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        setResolvedTheme(actualTheme);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (currentTheme === 'system') {
                const newTheme = e.matches ? 'dark' : 'light';
                document.documentElement.classList.toggle('dark', newTheme === 'dark');
                setResolvedTheme(newTheme);
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [currentTheme]);

    const handleThemeChange = (theme: Theme) => {
        setCurrentTheme(theme);
        localStorage.setItem('theme-preference', theme);

        if (theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const newTheme = systemDark ? 'dark' : 'light';
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            localStorage.setItem('theme', newTheme);
            setResolvedTheme(newTheme);
        } else {
            document.documentElement.classList.toggle('dark', theme === 'dark');
            localStorage.setItem('theme', theme);
            setResolvedTheme(theme);
        }
    };

    const ui = {
        page: "min-h-screen bg-background px-4 py-6 pb-32",
        container: "mx-auto max-w-2xl",
        header: "flex items-center gap-3.5 px-1 pt-2 pb-6",
        backBtn: "inline-flex h-10 w-10 items-center justify-center rounded-full cc-glass border border-secondary/15 text-foreground transition-all hover:bg-secondary/10",
        title: "text-2xl font-bold tracking-tight text-foreground",
        subtitle: "text-secondary text-[13px] font-medium leading-relaxed mt-1",
        section: "space-y-2.5",
        card: "cc-section overflow-hidden shadow-sm"
    };

    const themeOptions = [
        {
            value: 'light' as Theme,
            icon: SunIcon,
            title: 'Light'
        },
        {
            value: 'dark' as Theme,
            icon: MoonIcon,
            title: 'Dark'
        },
        {
            value: 'system' as Theme,
            icon: ComputerDesktopIcon,
            title: 'System'
        }
    ];

    // Prevent hydration mismatch
    if (!mounted) {
        return (
            <div className={ui.page}>
                <div className={ui.container}>
                    <header className={ui.header}>
                        <button onClick={() => router.back()} className={ui.backBtn}>
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className={ui.title}>Display</h1>
                        </div>
                    </header>
                </div>
            </div>
        );
    }

    return (
        <div className={ui.page}>
            <div className={ui.container}>
                {/* Header */}
                <div className="sticky top-0 z-40 -mx-4 px-4 md:-mx-8 md:px-8 pt-4 pb-12 pointer-events-none transition-all duration-300">
                    {/* Background Blur Layer */}
                    <div className="absolute inset-0 backdrop-blur-3xl bg-background/90 [mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_100%)]" />

                    <div className="relative flex items-center gap-2 pointer-events-auto">
                        <button
                            onClick={() => router.back()}
                            className="flex h-12 w-12 items-center justify-center rounded-full cc-header-btn active:scale-95 transition-all shrink-0 border cc-header-item-stroke"
                        >
                            <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                        </button>
                        <div className="flex items-center rounded-full cc-glass-strong px-6 py-3 border cc-header-item-stroke">
                            <h1 className="text-sm font-bold text-foreground">Display</h1>
                        </div>
                    </div>
                </div>

                {/* Appearance Section */}
                <section className={ui.section}>
                    <div className={ui.card}>
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                            {/* Label */}
                            <div>
                                <p className="text-[15px] font-semibold text-foreground">Appearance</p>
                            </div>

                            {/* Picker */}
                            <div className="flex items-center gap-2">
                                {themeOptions.map((option) => {
                                    const Icon = option.icon;
                                    const isActive = currentTheme === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => handleThemeChange(option.value)}
                                            className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all ${isActive
                                                ? 'bg-brand text-brand-foreground shadow-md shadow-brand/20'
                                                : 'bg-secondary/10 hover:bg-secondary/15 text-secondary hover:text-foreground'
                                                }`}
                                            title={option.title}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    {currentTheme === 'system' && (
                        <p className="text-[11px] text-secondary/60 ml-1.5 leading-relaxed">
                            Currently using {resolvedTheme} mode based on your device settings
                        </p>
                    )}
                </section>

                {/* Footer */}
                <SettingsFooter />
            </div>
        </div>
    );
}
