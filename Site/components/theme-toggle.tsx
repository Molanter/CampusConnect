"use client";

export function ThemeToggle() {
    const toggle = () => {
        const isDark = document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", !isDark);
        localStorage.setItem("theme", isDark ? "light" : "dark");
    };

    return (
        <button onClick={toggle} className="px-3 py-2 rounded bg-surface">
            Toggle theme
        </button>
    );
}
