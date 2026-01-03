
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { getCommunityGuidelines, CommunityGuidelines } from "@/lib/guidelines";

export default function GuidelinesPage() {
    const [guidelines, setGuidelines] = useState<CommunityGuidelines | null>(null);
    const [loading, setLoading] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        async function fetchGuidelines() {
            try {
                const data = await getCommunityGuidelines();
                setGuidelines(data);
            } finally {
                setLoading(false);
            }
        }
        fetchGuidelines();
    }, []);

    // Ensure page always loads at the top with multiple attempts
    useEffect(() => {
        // Immediate scroll
        window.scrollTo(0, 0);

        // Delayed scroll to handle any layout shifts
        const timeoutId = setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);

        return () => clearTimeout(timeoutId);
    }, []);

    // Scroll to top when pathname changes (navigation occurs)
    useEffect(() => {
        if (pathname === '/settings/guidelines') {
            window.scrollTo(0, 0);

            // Also try with a small delay for client-side navigation
            const timeoutId = setTimeout(() => {
                window.scrollTo(0, 0);
            }, 50);

            return () => clearTimeout(timeoutId);
        }
    }, [pathname]);

    // Scroll to top when loading completes
    useEffect(() => {
        if (!loading && guidelines) {
            window.scrollTo(0, 0);
        }
    }, [loading, guidelines]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
            </div>
        );
    }

    if (!guidelines) return null;

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* Header */}
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-40 pt-4 pointer-events-none">
                <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 pointer-events-auto">
                    <Link
                        href="/settings"
                        className="flex h-10 w-10 items-center justify-center rounded-full cc-header-btn active:scale-95"
                    >
                        <ChevronLeftIcon className="h-5 w-5 text-foreground" />
                    </Link>
                    <div className="flex items-center rounded-full cc-glass-strong px-6 py-2.5 shadow-sm">
                        <h1 className="text-sm font-bold text-foreground">Community Guidelines</h1>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 pt-24 pb-8">
                <div className="space-y-8">
                    {/* Introduction */}
                    <div className="cc-section rounded-3xl p-6 md:p-8 space-y-4">
                        <h2 className="text-2xl font-bold text-foreground">{guidelines.title}</h2>
                        {guidelines.intro && (
                            <p className="text-[15px] leading-relaxed text-foreground/90">
                                {guidelines.intro}
                            </p>
                        )}
                    </div>

                    {/* Sections */}
                    <div className="space-y-6">
                        {guidelines.sections?.map((section, idx) => (
                            <div key={idx} className="cc-section rounded-3xl p-6 md:p-8">
                                <h3 className="mb-3 text-lg font-bold text-foreground">
                                    {section.title}
                                </h3>
                                <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/80 pl-4 border-l-2 border-brand/30">
                                    {section.body}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Outro */}
                    {guidelines.outro && (
                        <div className="text-center px-6">
                            <p className="font-medium text-foreground/60 italic">
                                {guidelines.outro}
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
