"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { RightSidebarProvider, useRightSidebar } from "@/components/right-sidebar-context";
import { RightSidebar } from "@/components/right-sidebar";

function InnerLayout({ children }: { children: React.ReactNode }) {
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [viewportWidth, setViewportWidth] = useState<number | null>(null);
    const { isVisible: isRightSidebarVisible, sidebarWidth } = useRightSidebar();

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleResize = () => {
            const width = window.innerWidth;
            setViewportWidth(width);

            // Hide sidebar for tablet (769-1024) and mobile (<= 768)
            if (width <= 1024) {
                setSidebarVisible(false);
            } else {
                setSidebarVisible(true);
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const width = viewportWidth ?? 1024;
    const leftSidebarClass = sidebarVisible && width > 768 ? "md:pl-[312px]" : "";

    // Calculate right padding based on sidebar width + margins (12px on each side = 24px total)
    // Apply for tablet (769-1024) and desktop (>1024) to prevent overlay
    const rightPadding = isRightSidebarVisible && width > 768 ? sidebarWidth + 24 : 0;

    // Header is shown if sidebar is hidden (tabbar behavior).
    // If sidebar is open, header is hidden.
    const showHeader = !sidebarVisible;

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <Navbar
                sidebarVisible={sidebarVisible}
                setSidebarVisible={setSidebarVisible}
                viewportWidth={viewportWidth}
            />

            <main className="flex-1 w-full overflow-auto relative scrollbar-track-transparent">
                <div
                    className={`mx-auto max-w-[1600px] w-full pt-20 px-4 md:px-6 transition-all duration-200 ${leftSidebarClass}`}
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
        <RightSidebarProvider>
            <InnerLayout>{children}</InnerLayout>
        </RightSidebarProvider>
    );
}
