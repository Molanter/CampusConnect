"use client";

import React, { createContext, useContext, useState, useMemo } from "react";

type MainLayoutMetrics = {
    mainWidth: number;
    isMainNarrow: boolean;     // < 768px (Tablet/Mobile breakpoint behavior)
    isMainVeryNarrow: boolean; // < 480px (Phone breakpoint behavior)
};

type MainLayoutMetricsContextType = MainLayoutMetrics & {
    setMainWidth: (width: number) => void;
};

const MainLayoutMetricsContext = createContext<MainLayoutMetricsContextType | null>(null);

export function MainLayoutMetricsProvider({ children }: { children: React.ReactNode }) {
    const [mainWidth, setMainWidth] = useState(1024); // Default to desktop-ish

    const value = useMemo(() => {
        const isMainNarrow = mainWidth < 768;
        const isMainVeryNarrow = mainWidth < 480;

        return {
            mainWidth,
            isMainNarrow,
            isMainVeryNarrow,
            setMainWidth
        };
    }, [mainWidth]);

    return (
        <MainLayoutMetricsContext.Provider value={value}>
            {children}
        </MainLayoutMetricsContext.Provider>
    );
}

export function useMainLayoutMetrics() {
    const context = useContext(MainLayoutMetricsContext);
    if (!context) {
        throw new Error("useMainLayoutMetrics must be used within MainLayoutMetricsProvider");
    }
    return context;
}
