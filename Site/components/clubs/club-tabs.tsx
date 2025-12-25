"use client";

import { useRef, useState, useLayoutEffect, useEffect, useMemo } from "react";
import { motion, useSpring, useTransform, MotionValue } from "framer-motion";

export type ClubTab = "posts" | "members" | "about" | "requests";

export interface TabItem {
    key: ClubTab;
    label: string;
}

interface ClubTabsProps {
    tabs: TabItem[];
    activeTab: ClubTab;
    onTabChange: (key: ClubTab) => void;
    isNarrow?: boolean; // Kept for compatibility but unused stylistically in this component
    progress?: MotionValue<number>;
}

export function ClubTabs({ tabs, activeTab, onTabChange, progress }: ClubTabsProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);

    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
    const [isHydrated, setIsHydrated] = useState(false);
    const hasMeasured = useRef(false);

    const activeIndex = useMemo(() => tabs.findIndex((t) => t.key === activeTab), [tabs, activeTab]);

    const measure = () => {
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;

        const measurements = tabs.map((_, i) => {
            const labelSpan = labelRefs.current[i];
            if (!labelSpan) return { x: 0, width: 0 };

            const labelRect = labelSpan.getBoundingClientRect();
            const targetWidth = labelRect.width + 12;

            const relativeSpanLeft = labelRect.left - containerRect.left + scrollLeft;
            const x = relativeSpanLeft + (labelRect.width / 2) - (targetWidth / 2);

            return { x, width: targetWidth };
        });

        return measurements;
    };

    const [allMeasurements, setAllMeasurements] = useState<{ x: number; width: number }[]>([]);

    const updateMeasurements = () => {
        const m = measure();
        if (m) {
            setAllMeasurements(m);
            setIsHydrated(true);

            if (m[activeIndex]) {
                const target = m[activeIndex];
                setIndicatorStyle({ left: target.x, width: target.width });

                if (!hasMeasured.current && !progress) {
                    springX.set(target.x);
                    springWidth.set(target.width);
                    hasMeasured.current = true;
                }
            }
        }
    };

    const springX = useSpring(0, { stiffness: 700, damping: 35 });
    const springWidth = useSpring(0, { stiffness: 700, damping: 35 });

    useEffect(() => {
        if (hasMeasured.current && !progress && allMeasurements[activeIndex]) {
            springX.set(allMeasurements[activeIndex].x);
            springWidth.set(allMeasurements[activeIndex].width);
        }
    }, [activeIndex, allMeasurements, progress, springX, springWidth]);

    const inputRange = useMemo(() => tabs.map((_, i) => i / (tabs.length - 1)), [tabs]);
    const outputX = useMemo(() => allMeasurements.map(m => m.x), [allMeasurements]);
    const outputWidth = useMemo(() => allMeasurements.map(m => m.width), [allMeasurements]);

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

    const smoothX = useSpring(interpX, { stiffness: 500, damping: 40 });
    const smoothWidth = useSpring(interpWidth, { stiffness: 500, damping: 40 });

    const x = progress ? smoothX : springX;
    const width = progress ? smoothWidth : springWidth;

    useLayoutEffect(() => {
        updateMeasurements();
        window.addEventListener("resize", updateMeasurements);
        const observer = new ResizeObserver(() => {
            updateMeasurements();
        });
        if (containerRef.current) observer.observe(containerRef.current);

        return () => {
            window.removeEventListener("resize", updateMeasurements);
            observer.disconnect();
        };
    }, [tabs, activeTab]);

    return (
        <div className="w-full flex justify-center py-1">
            <div
                ref={containerRef}
                className="relative inline-flex items-center justify-center gap-10 overflow-x-auto scrollbar-hide px-6 pb-3 pt-2"
                style={{ scrollBehavior: 'smooth' }}
            >
                {tabs.map((tab, idx) => {
                    const isActive = tab.key === activeTab;

                    return (
                        <button
                            key={tab.key}
                            ref={el => { tabRefs.current[idx] = el; }}
                            onClick={() => onTabChange(tab.key)}
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

                {isHydrated && (
                    <motion.div
                        className="absolute bottom-0 left-0 h-[4px] bg-amber-500 rounded-full pointer-events-none"
                        style={{
                            x,
                            width,
                            opacity: hasMeasured.current || progress ? 1 : 0
                        }}
                        initial={false}
                    />
                )}
            </div>
        </div>
    );
}
