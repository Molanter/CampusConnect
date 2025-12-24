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
            const labelSpan = labelRefs.current[i];
            if (!labelSpan) return { x: 0, width: 0 };

            const labelRect = labelSpan.getBoundingClientRect();

            // Per requirements: indicator width = label width + 16 (padding)
            const targetWidth = labelRect.width + 12; // 12px looks slightly tighter/cleaner, but let's stick closer to request

            // Calculate relative X
            // labelRect.left is viewport relative. containerRect.left is viewport relative.
            // We need position inside the container.
            // relativeLeft = labelRect.left - containerRect.left + container.scrollLeft

            // Center the indicator relative to the label span
            // center of label = relativeLeft + labelRect.width / 2
            // center of indicator = x + targetWidth / 2
            // x = (relativeLeft + labelRect.width / 2) - targetWidth / 2

            const relativeSpanLeft = labelRect.left - containerRect.left + scrollLeft;
            const x = relativeSpanLeft + (labelRect.width / 2) - (targetWidth / 2);

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
        <div className="w-full flex justify-center py-1">
            <div
                ref={containerRef}
                className="relative inline-flex items-center justify-center gap-10 overflow-x-auto scrollbar-hide px-6 pb-3 pt-2"
                style={{ scrollBehavior: 'smooth' }}
            >
                {tabs.map((tab, idx) => {
                    const isActive = tab.key === value;

                    return (
                        <button
                            key={tab.key}
                            ref={el => { tabRefs.current[idx] = el; }}
                            onClick={() => onChange(tab.key)}
                            // Ensure no default padding messes up our measurement wrapper
                            className="group relative flex flex-col items-center justify-center outline-none"
                        >
                            <span
                                ref={el => { labelRefs.current[idx] = el; }}
                                className={`
                                    whitespace-nowrap text-[15px] transition-colors duration-200
                                    ${isActive
                                        ? "font-semibold text-white shadow-black drop-shadow-sm"
                                        : "font-semibold text-neutral-400 group-hover:text-neutral-200"
                                    }
                                `}
                            >
                                {tab.label}
                            </span>
                        </button>
                    );
                })}

                {/* Indicator Pill */}
                {/* Render only if we have metrics to avoid jumping */}
                {isHydrated && (
                    <motion.div
                        className="absolute bottom-0 left-0 h-[4px] bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] pointer-events-none"
                        style={{
                            x,
                            width,
                            // If we haven't measured yet, hide it
                            opacity: hasMeasured.current || progress ? 1 : 0
                        }}
                        initial={false}
                    />
                )}
            </div>
        </div>
    );
}
