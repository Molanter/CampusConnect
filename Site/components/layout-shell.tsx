"use client";

import { useEffect, useState, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { RightSidebarProvider, useRightSidebar } from "@/components/right-sidebar-context";
import { RightSidebar } from "@/components/right-sidebar";
import { UserProfilesProvider } from "@/components/user-profiles-context";
import { ClubProfilesProvider } from "@/components/club-profiles-context";
import { AdminModeProvider } from "@/components/admin-mode-context";

function InnerLayout({ children }: { children: React.ReactNode }) {
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const { isVisible: isRightSidebarVisible, sidebarWidth, isNarrow, setIsNarrow, close, view } = useRightSidebar();
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!contentRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                const threshold = 750;
                const narrow = width < threshold;
                if (narrow !== isNarrow) {
                    setIsNarrow(narrow);
                }
            }
        });

        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [isNarrow, setIsNarrow]);

    // Auto-hide right sidebar if we enter narrow mode and it's just showing notifications
    useEffect(() => {
        if (isNarrow && isRightSidebarVisible && view === "notifications") {
            close();
        }
    }, [isNarrow, isRightSidebarVisible, view, close]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleResize = () => {
            const width = window.innerWidth;
            setViewportWidth(width);
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const width = viewportWidth ?? 1024;
    // Sidebar width (72px) + Left Margin (12px) + Gap (16px) = 100px approximately
    // Using pl-[112px] for a bit more breathing room
    // Left styling is applied if width > 768 (Desktop/Tablet)
    const leftSidebarClass = width > 768 ? "md:pl-[120px]" : "";

    // Calculate right padding based on sidebar width + margins (12px on each side = 24px total)
    // Apply for tablet (769-1024) and desktop (>1024) to prevent overlay
    const rightPadding = isRightSidebarVisible && width > 768 ? sidebarWidth + 24 : 0;

    // Header is shown if we are on mobile (<= 768)
    // Actually header visibility logic was based on sidebarVisible before.
    // Now sidebar (left tabbar) is ALWAYS visible on desktop and NEVER on mobile.
    // So header (top tabbar) should be visible on mobile.
    const showHeader = width <= 768;

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <Navbar
                viewportWidth={viewportWidth}
            />

            <main className="flex-1 w-full overflow-y-auto overflow-x-hidden relative scrollbar-track-transparent">
                <div
                    ref={contentRef}
                    className={`mx-auto max-w-[1600px] w-full pt-20 md:pt-6 px-4 md:px-6 transition-all duration-200 [@container] ${leftSidebarClass}`}
                    style={{ paddingRight: rightPadding > 0 ? `${rightPadding}px` : undefined }}
                >
                    {children}
                </div>
            </main>

            <RightSidebar headerVisible={showHeader} />
        </div>
    );
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <AdminModeProvider>
            <UserProfilesProvider>
                <ClubProfilesProvider>
                    <RightSidebarProvider>
                        <InnerLayout>{children}</InnerLayout>
                    </RightSidebarProvider>
                </ClubProfilesProvider>
            </UserProfilesProvider>
        </AdminModeProvider>
    );
}
