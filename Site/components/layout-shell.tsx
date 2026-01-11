"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { RightSidebarProvider, useRightSidebar } from "@/components/right-sidebar-context";
import { RightSidebar } from "@/components/right-sidebar";
import { UserProfilesProvider } from "@/components/user-profiles-context";
import { ClubProfilesProvider } from "@/components/club-profiles-context";
import { AdminModeProvider } from "@/components/admin-mode-context";
import { MainLayoutMetricsProvider, useMainLayoutMetrics } from "@/components/main-layout-metrics-context";
import { FCMInitializer } from "@/components/fcm-initializer";

function InnerLayoutContent({ children }: { children: React.ReactNode }) {
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const { isVisible: isRightSidebarVisible, sidebarWidth, isNarrow, setIsNarrow, close, view } = useRightSidebar();
    const { setMainWidth, isMainNarrow, isMainVeryNarrow, mainWidth } = useMainLayoutMetrics();
    const contentRef = useRef<HTMLDivElement>(null);
    const mainRef = useRef<HTMLElement>(null);
    const pathname = usePathname();
    const [prevViewportWidth, setPrevViewportWidth] = useState<number | null>(null);

    // Reset scroll to top on route change
    useEffect(() => {
        if (mainRef.current) {
            mainRef.current.scrollTop = 0;
        }
    }, [pathname]);

    // Measure Real Main Width
    useEffect(() => {
        if (!mainRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Measure the MAIN container width
                const measuredWidth = entry.contentRect.width;
                setMainWidth(measuredWidth);

                // Update legacy "isNarrow" for sidebar interaction (optional, keeping existing logic sync)
                // Existing logic used contentRef (inner div), but mainRef is the flex container.
                // Keeping them separate is fine, layout metrics is for CHILDREN responsiveness.
            }
        });

        observer.observe(mainRef.current);
        return () => observer.disconnect();
    }, [setMainWidth]);

    // Existing "Narrow" detection for sidebar auto-close (uses contentRef)
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
    // Only close if the viewport itself shrunk, not if the user is expanding the sidebar
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const currentWidth = window.innerWidth;

        // Only close sidebar if viewport shrunk AND main content is narrow
        if (isNarrow && isRightSidebarVisible && view === "notifications") {
            // If we have a previous width and current width is smaller, viewport shrunk
            if (prevViewportWidth === null || currentWidth < prevViewportWidth) {
                close();
            }
        }

        setPrevViewportWidth(currentWidth);
    }, [isNarrow, isRightSidebarVisible, view, close, prevViewportWidth]);

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
    const isMobile = width <= 768;
    const leftSidebarClass = width > 768 ? "md:pl-[120px]" : "";

    // Determine if we are on a main tabbed page that shows the floating mobile navbar
    const tabRoutes = ["/", "/explore", "/posts/new", "/profile", "/settings"];
    const isTabPage = tabRoutes.includes(pathname) || pathname.startsWith("/admin");
    const showHeader = isMobile && isTabPage;

    return (
        <div
            className={`flex h-full flex-col overflow-hidden ${isMainNarrow ? 'cc-main-narrow' : ''} ${isMainVeryNarrow ? 'cc-main-very-narrow' : ''}`}
            style={{
                // Expose width to CSS for calculations if needed
                ["--cc-main-width" as any]: `${mainWidth}px`
            }}
        >
            <Navbar viewportWidth={viewportWidth} isTabPage={isTabPage} />

            {/* Main content + sidebar flex container */}
            <div className="flex flex-1 overflow-hidden">
                {/* Main content area - shrinks when sidebar opens */}
                <main
                    ref={mainRef}
                    className="flex-1 md:min-w-[500px] min-w-0 overflow-y-auto overflow-x-hidden relative scrollbar-track-transparent"
                >
                    <div
                        ref={contentRef}
                        className={`mx-auto max-w-[1600px] w-full ${isMobile && isTabPage ? 'pb-20' : 'pb-0'} md:pt-6 px-4 md:px-6 transition-all duration-200 [@container] ${leftSidebarClass}`}
                    >
                        {children}
                    </div>
                </main>

                {/* Right sidebar - takes physical space when open on desktop */}
                {!isMobile && isRightSidebarVisible && (
                    <aside
                        className="shrink-0 overflow-hidden"
                        style={{ width: `${sidebarWidth}px`, minWidth: '347px' }}
                    >
                        <RightSidebar headerVisible={showHeader} />
                    </aside>
                )}
            </div>

            {/* Mobile sidebar (overlay/fixed via component) */}
            {isMobile && <RightSidebar headerVisible={showHeader} />}
        </div>
    );
}

function InnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <MainLayoutMetricsProvider>
            <InnerLayoutContent>{children}</InnerLayoutContent>
        </MainLayoutMetricsProvider>
    );
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <AdminModeProvider>
            <UserProfilesProvider>
                <ClubProfilesProvider>
                    <RightSidebarProvider>
                        <FCMInitializer />
                        <InnerLayout>{children}</InnerLayout>
                    </RightSidebarProvider>
                </ClubProfilesProvider>
            </UserProfilesProvider>
        </AdminModeProvider>
    );
}
