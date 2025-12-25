"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
    motion,
    AnimatePresence,
    useMotionValue,
    animate
} from "framer-motion";

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    initialSnap?: "peek" | "full";
}

export function MobileBottomSheet({ isOpen, onClose, children, initialSnap = "peek" }: MobileBottomSheetProps) {
    // -- State & Refs --
    const sheetRef = useRef<HTMLDivElement>(null);

    // Height constants
    // Full: ~8vh from top.
    // Peek: ~45vh from top (approx 55% height).
    // Closed: 100vh from top (offscreen).
    const y = useMotionValue(window.innerHeight);
    const [isDragging, setIsDragging] = useState(false);

    // -- Snap Logic --

    const getSnapPoints = useCallback(() => {
        if (typeof window === 'undefined') return { full: 0, peek: 0, closed: 0 };
        const h = window.innerHeight;
        return {
            full: h * 0.08, // 8vh from top
            peek: h * 0.45, // 45vh from top
            closed: h,      // Offscreen
        };
    }, []);

    const snapTo = useCallback((targetSnap: "peek" | "full" | "closed") => {
        const points = getSnapPoints();
        const targetY = points[targetSnap];

        animate(y, targetY, {
            type: "spring",
            damping: 30,
            stiffness: 300,
            onComplete: () => {
                if (targetSnap === "closed") {
                    onClose();
                }
            }
        });
    }, [y, onClose, getSnapPoints]);

    // -- Lifecycle --

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            snapTo(initialSnap);
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen, initialSnap, snapTo]);

    // Track the current Y position to constrain height
    const [currentSnapY, setCurrentSnapY] = useState(getSnapPoints().peek);

    useEffect(() => {
        const unsubscribe = y.on("change", (latestY) => {
            setCurrentSnapY(latestY);
        });
        return unsubscribe;
    }, [y]);


    // -- Pointer Handlers (Handle Only) --

    const dragState = useRef({
        startY: 0,
        startSheetY: 0,
        isDragging: false,
        activePointerId: -1,
    });

    const onPointerDownHandle = (e: React.PointerEvent) => {
        // Critical: Only capture, do not scroll
        e.currentTarget.setPointerCapture(e.pointerId);
        e.preventDefault();

        dragState.current = {
            startY: e.clientY,
            startSheetY: y.get(),
            isDragging: true,
            activePointerId: e.pointerId,
        };
        setIsDragging(true);
    };

    const onPointerMoveHandle = (e: React.PointerEvent) => {
        const { isDragging, startY, startSheetY, activePointerId } = dragState.current;
        if (!isDragging || e.pointerId !== activePointerId) return;

        // Prevent default only during handle drag
        e.preventDefault();

        const dy = e.clientY - startY;
        const newY = startSheetY + dy;

        // Friction logic
        const points = getSnapPoints();
        if (newY < points.full) {
            const excess = points.full - newY;
            y.set(points.full - (excess * 0.2));
        } else {
            y.set(newY);
        }
    };

    const onPointerUpHandle = (e: React.PointerEvent) => {
        const { isDragging, activePointerId } = dragState.current;
        if (!isDragging || e.pointerId !== activePointerId) return;

        dragState.current.isDragging = false;
        dragState.current.activePointerId = -1;
        setIsDragging(false);

        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) { }

        // Snap Logic
        const currentY = y.get();
        const points = getSnapPoints();

        // Thresholds
        const closeThreshold = points.peek + 100;

        if (currentY > closeThreshold) {
            snapTo("closed");
        }
        else if (Math.abs(currentY - points.full) < Math.abs(currentY - points.peek)) {
            snapTo("full");
        }
        else {
            snapTo("peek");
        }
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    {/* Ensure backdrop is BEHIND sheet (z-40 vs z-50) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40 touch-none"
                        onClick={onClose}
                    />

                    {/* Sheet Container */}
                    <motion.div
                        ref={sheetRef}
                        style={{
                            y,
                            bottom: 0,
                            touchAction: "pan-y",
                            maxHeight: `calc(100dvh - ${Math.max(0, currentSnapY)}px)` // Constrain to visible area
                        }}
                        initial={{ y: window.innerHeight }}
                        exit={{ y: window.innerHeight }}
                        // Ensure wrapper allows touch-action: pan-y so children can scroll
                        // Do NOT put pointer listeners here
                        className="fixed inset-x-0 w-full z-50 flex flex-col bg-[#121212]/95 backdrop-blur-3xl rounded-t-[2rem] border-t border-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.9)] pb-safe will-change-transform"
                    >
                        {/* Handle - Strict Interactions */}
                        <div
                            onPointerDown={onPointerDownHandle}
                            onPointerMove={onPointerMoveHandle}
                            onPointerUp={onPointerUpHandle}
                            onPointerCancel={onPointerUpHandle}
                            // Explicit styling for touch action
                            style={{ touchAction: "none" }}
                            className="w-full shrink-0 flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing select-none"
                        >
                            <div className="w-12 h-1.5 bg-white/20 rounded-full active:bg-white/40 transition-colors pointer-events-none" />
                        </div>

                        {/* Content Shell - flex-1 min-h-0 allows children to expand and scroll */}
                        {/* We do NOT set overflow here; we let children handle it */}
                        <div className="flex-1 min-h-0 flex flex-col w-full">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
