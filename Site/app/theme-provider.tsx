"use client";

import { useEffect } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    const saved = (localStorage.getItem("theme") as Theme | null) ?? null;
    if (saved === "light" || saved === "dark") return saved;
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return systemDark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const initial = getInitialTheme();
        document.documentElement.classList.toggle("dark", initial === "dark");
    }, []);

    return <>{children}</>;
}

/** Optional helper you can import where the toggle button lives */
export function setTheme(next: Theme) {
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
}