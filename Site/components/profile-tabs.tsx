"use client";

import { useRef, useState, useLayoutEffect, useEffect, useMemo } from "react";
import { motion, useSpring, useTransform, MotionValue } from "framer-motion";

export type Tab = "my-events" | "attended" | "comments" | "clubs";

export interface TabItem {
    key: string;
    label: string;
}

interface ProfileTabsProps {
    tabs: TabItem[];
    value: string;
    onChange: (key: string) => void;
    // Optional framer-motion value for swipe progress (0..tabs.length-1)
    progress?: MotionValue<number>;
}

export function ProfileTabs({ tabs, value, onChange, progress }: ProfileTabsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isHydrated, setIsHydrated] = useState(false);

    // We use a ref to track if we've successfully measured at least once
    // to prevent jumping from 0 on initial load.
    const hasMeasured = useRef(false);

    const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === value), [tabs, value]);

    // -------------------------------------------------------------------------
    // Measurements
    // -------------------------------------------------------------------------
    // We need:
    // 1. Container left
    // 2. Active tab's label span left & width
    // 3. Indicator should be: left = (spanLeft - containerLeft)
    // 4. Indicator width = spanWidth + 16 (or just match spanWidth, user said "Match label width or be a fixed width")
    //    User also said: "indicatorWidth = labelRect.width + 16" and "x = labelRect.left - barRect.left ... + (labelRect.width - indicatorWidth)/2"
    //    Actually, let's follow the centering math requested:
    //    indicatorWidth = labelRect.width + 16
    //    x = (labelRect.left - barRect.left) + (labelRect.width - indicatorWidth) / 2
    //    Use scrollLeft adjustment if container scrolls.

    const measure = () => {
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;

        // We capture measurements for ALL tabs so we can interpolate if progress is present
        const measurements = tabs.map((_, i) => {
            const button = tabRefs.current[i];
            if (!button) return { x: 0, width: 0 };

            const buttonRect = button.getBoundingClientRect();
            const targetWidth = buttonRect.width;

            const x = buttonRect.left - containerRect.left + scrollLeft;

            return { x, width: targetWidth };
        });

        return measurements;
    };

    // Store all measurements to allow interpolation
    const [allMeasurements, setAllMeasurements] = useState<{ x: number; width: number }[]>([]);

    const updateMeasurements = () => {
        const m = measure();
        if (m) {
            setAllMeasurements(m);
            setIsHydrated(true);

            // If we have an active index, update the discrete target
            if (m[activeIndex]) {
                const target = m[activeIndex];
                // Sync the discrete state
                setIndicatorStyle({ left: target.x, width: target.width });

                // If it's the first time, snap the springs immediately
                if (!hasMeasured.current && !progress) {
                    springX.set(target.x);
                    springWidth.set(target.width);
                    hasMeasured.current = true;
                }
            }
        }
    };

    // -------------------------------------------------------------------------
    // Springs & Interpolation
    // -------------------------------------------------------------------------
    // User requested "Spring-like easing".
    // We use a spring for the 'value' based changes (clicks).
    // If 'progress' is provided (swipe), we interpolate between measurements.

    const springX = useSpring(0, { stiffness: 700, damping: 35 });
    const springWidth = useSpring(0, { stiffness: 700, damping: 35 });

    // Sync springs to active tab state changes (clicks / programmatic)
    useEffect(() => {
        if (hasMeasured.current && !progress && allMeasurements[activeIndex]) {
            springX.set(allMeasurements[activeIndex].x);
            springWidth.set(allMeasurements[activeIndex].width);
        }
    }, [activeIndex, allMeasurements, progress, springX, springWidth]);

    // Interpolation for Swipe
    const inputRange = useMemo(() => tabs.map((_, i) => i / (tabs.length - 1)), [tabs]);
    const outputX = useMemo(() => allMeasurements.map(m => m.x), [allMeasurements]);
    const outputWidth = useMemo(() => allMeasurements.map(m => m.width), [allMeasurements]);

    // We only use interpolation if we have valid measurements for all tabs
    const validMetrics = allMeasurements.length === tabs.length;

    const interpX = useTransform(
        progress || new MotionValue(0),
        inputRange,
        validMetrics ? outputX : tabs.map(() => 0)
    );

    const interpWidth = useTransform(
        progress || new MotionValue(0),
        inputRange,
        validMetrics ? outputWidth : tabs.map(() => 0)
    );

    // Smooth out the scroll jitter using a spring
    // High stiffness = fast tracking, Damping = no overshoot
    const smoothX = useSpring(interpX, { stiffness: 500, damping: 40 });
    const smoothWidth = useSpring(interpWidth, { stiffness: 500, damping: 40 });

    // Final transform values
    const x = progress ? smoothX : springX;
    const width = progress ? smoothWidth : springWidth;

    // -------------------------------------------------------------------------
    // Observers
    // -------------------------------------------------------------------------
    useLayoutEffect(() => {
        updateMeasurements();

        // Window resize
        window.addEventListener("resize", updateMeasurements);

        // Container resize (if centering changes)
        const observer = new ResizeObserver(() => {
            updateMeasurements();
        });
        if (containerRef.current) observer.observe(containerRef.current);

        // Also observe active label specifically if possible (font loading etc)
        // But observing the container + window resize is usually enough. 
        // Let's rely on standard ResizeObserver.

        return () => {
            window.removeEventListener("resize", updateMeasurements);
            observer.disconnect();
        };
    }, [tabs, value]);
    // ^ Dependency on 'value' ensures we re-measure if the active tab changes 
    // (e.g. font weight change alters width).

    return (
        <div className="w-full flex justify-center py-2">
            <div className="relative w-max max-w-full">
                {/* Fixed background pill */}
                <div className="absolute inset-0 cc-glass rounded-full border-2 border-secondary/20 shadow-sm pointer-events-none" />

                {/* Scrollable content container */}
                <div className="relative overflow-hidden rounded-full">
                    <div className="p-1 overflow-x-auto scrollbar-hide">
                        <div
                            ref={containerRef}
                            className="relative flex items-center gap-1 w-max min-w-full"
                            style={{ scrollBehavior: 'smooth' }}
                        >
                            {/* Animated sliding capsule */}
                            {isHydrated && (
                                <motion.div
                                    className="absolute bg-foreground/10 border border-secondary/20 rounded-full shadow-sm pointer-events-none"
                                    style={{
                                        x,
                                        width,
                                        height: 'calc(100% - 2px)',
                                        top: '1px',
                                        opacity: hasMeasured.current || progress ? 1 : 0
                                    }}
                                    initial={false}
                                >
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/5 to-transparent" />
                                </motion.div>
                            )}

                            {tabs.map((tab, idx) => {
                                const isActive = tab.key === value;

                                return (
                                    <button
                                        key={tab.key}
                                        ref={el => { tabRefs.current[idx] = el; }}
                                        onClick={() => onChange(tab.key)}
                                        className="relative flex-shrink-0 px-5 py-2 rounded-full font-semibold text-[16px] group z-10 outline-none"
                                    >
                                        <span
                                            ref={el => { labelRefs.current[idx] = el; }}
                                            className={`
                                                relative flex items-center justify-center whitespace-nowrap transition-all duration-300
                                                ${isActive ? "text-foreground" : "text-secondary hover:text-foreground/80"}
                                            `}
                                        >
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
