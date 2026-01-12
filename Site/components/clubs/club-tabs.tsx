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
            const button = tabRefs.current[i];
            if (!button) return { x: 0, width: 0 };

            const buttonRect = button.getBoundingClientRect();
            const targetWidth = buttonRect.width;

            // Indicator should be relative to containerRef content box
            const x = buttonRect.left - containerRect.left + scrollLeft;

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
                                const isActive = tab.key === activeTab;

                                return (
                                    <button
                                        key={tab.key}
                                        ref={el => { tabRefs.current[idx] = el; }}
                                        onClick={() => onTabChange(tab.key)}
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
