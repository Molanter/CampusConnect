"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type RightSidebarView = "notifications" | "comments" | "details" | "attendance" | "report" | "likes" | "my-clubs" | "report-details" | "post-history" | "club-privacy-info" | "support-ticket-info";

interface RightSidebarContextType {
    isVisible: boolean;
    view: RightSidebarView;
    data: any;
    isNarrow: boolean;
    setIsNarrow: (val: boolean) => void;
    sidebarWidth: number;
    setSidebarWidth: (width: number) => void;
    toggle: () => void;
    openView: (view: RightSidebarView, data?: any) => void;
    close: () => void;
    showNotifications: () => void;
}

const RightSidebarContext = createContext<RightSidebarContextType | undefined>(undefined);

export function RightSidebarProvider({ children }: { children: ReactNode }) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Auto-open on desktop only (matches logic in right-sidebar.tsx)
        if (typeof window !== 'undefined' && window.innerWidth > 1024) {
            setIsVisible(true);
        }
    }, []);

    const [view, setView] = useState<RightSidebarView>("notifications");
    const [data, setData] = useState<any>(null);
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [isNarrow, setIsNarrow] = useState(false);

    const toggle = useCallback(() => setIsVisible((prev) => !prev), []);

    const openView = useCallback((newView: RightSidebarView, newData?: any) => {
        setView(newView);
        if (newData !== undefined) setData(newData);
        setIsVisible(true);
    }, []);

    const close = useCallback(() => setIsVisible(false), []);

    const showNotifications = useCallback(() => {
        setView("notifications");
        setData(null);
        setIsVisible(true);
    }, []);

    return (
        <RightSidebarContext.Provider
            value={{
                isVisible,
                isNarrow,
                setIsNarrow,
                view,
                data,
                sidebarWidth,
                setSidebarWidth,
                toggle,
                openView,
                close,
                showNotifications,
            }}
        >
            {children}
        </RightSidebarContext.Provider>
    );
}

export function useRightSidebar() {
    const context = useContext(RightSidebarContext);
    if (context === undefined) {
        throw new Error("useRightSidebar must be used within a RightSidebarProvider");
    }
    return context;
}
